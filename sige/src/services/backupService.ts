import cron from 'node-cron';
import { createHash } from 'crypto';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { BackupEstado } from '@prisma/client';
import { supabaseAdmin, BUCKETS } from '../config/supabase';

export const BACKUP_BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BACKUPS || 'backups';
const BACKUP_MAX = Math.max(1, parseInt(process.env.BACKUP_MAX_VERSIONES || '7', 10));
const BACKUP_CRON = process.env.BACKUP_CRON || '0 3 * * *';
const BUCKETS_ARCHIVOS = [BUCKETS.LOGOS, BUCKETS.AVATARES, BUCKETS.DOCUMENTOS, BUCKETS.VOUCHERS] as const;
type ArchivoFuente = { bucket: string; path: string; url: string };
type ArchivoManifest = ArchivoFuente & { backupPath: string; bytes: number };
type BackupMetaAnterior = { hashContenido?: string; totalRegistros?: number; conteosTablas?: Record<string, number> };

let ejecucionEnCurso = false;

export function initBackupCron(): void {
  if (!cron.validate(BACKUP_CRON)) throw new Error(`BACKUP_CRON inválido: "${BACKUP_CRON}"`);
  const timezone = process.env.BACKUP_TIMEZONE || 'America/Lima';
  cron.schedule(BACKUP_CRON, async () => {
    try { await ejecutarBackup(); }
    catch (error) { logger.warn('Backup programado omitido o fallido.', error); }
  }, { timezone });
  logger.info(`✅ Backup cron iniciado [${BACKUP_CRON}] (${timezone}) — retención: ${BACKUP_MAX} versiones — bucket: ${BACKUP_BUCKET}`);
}

function pathDesdeUrl(url: string, bucket: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    for (const marker of [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`, `/${bucket}/`]) {
      const index = pathname.indexOf(marker);
      if (index !== -1) return decodeURIComponent(pathname.slice(index + marker.length));
    }
  } catch { /* URL externa o inválida: no pertenece a nuestro Storage. */ }
  return null;
}

function extraerArchivos(valor: unknown): ArchivoFuente[] {
  const encontrados = new Map<string, ArchivoFuente>();
  const visitar = (actual: unknown) => {
    if (typeof actual === 'string' && actual.includes('/storage/')) {
      for (const bucket of BUCKETS_ARCHIVOS) {
        const path = pathDesdeUrl(actual, bucket);
        if (path) encontrados.set(`${bucket}/${path}`, { bucket, path, url: actual });
      }
    } else if (Array.isArray(actual)) actual.forEach(visitar);
    else if (actual && typeof actual === 'object') Object.values(actual as Record<string, unknown>).forEach(visitar);
  };
  visitar(valor);
  return [...encontrados.values()];
}

async function crearSnapshot(colegioId: string) {
  const directos: Array<[string, string]> = [
    ['usuarios', 'usuario'], ['nivelesGrados', 'nivelGrado'], ['aulas', 'aula'], ['cursos', 'curso'],
    ['notas', 'nota'], ['recuperaciones', 'recuperacion'], ['horarios', 'horario'], ['estudiantes', 'estudiante'],
    ['padres', 'padre'], ['matriculas', 'matricula'], ['asistencias', 'asistencia'], ['conceptosPago', 'conceptoPago'],
    ['pagos', 'pago'], ['comunicados', 'comunicado'], ['eventos', 'evento'], ['encuestas', 'encuesta'],
    ['observaciones', 'observacion'], ['permisosSalida', 'permisoSalida'], ['documentos', 'documento'],
    ['conversaciones', 'conversacion'], ['chatbotPreguntas', 'chatbotPregunta'], ['auditoria', 'auditoria'],
    ['exportaciones', 'exportacion'], ['licencias', 'licencia'], ['pagosLicencia', 'pagoLicencia'],
  ];
  const valores = await Promise.all(directos.map(async ([nombre, delegate]) => [nombre, await (prisma as any)[delegate].findMany({ where: { colegioId } })]));
  const tablas: Record<string, any[]> = Object.fromEntries(valores);
  const [colegio, secciones, docentesAula, padresEstudiantes, encuestaPreguntas, encuestaRespuestas, encuestaDetalles, mensajes, notificaciones] = await Promise.all([
    prisma.colegio.findUnique({ where: { id: colegioId } }),
    prisma.seccion.findMany({ where: { nivelGrado: { colegioId } } }),
    prisma.docenteAula.findMany({ where: { aula: { colegioId } } }),
    prisma.padreEstudiante.findMany({ where: { estudiante: { colegioId } } }),
    prisma.encuestaPregunta.findMany({ where: { encuesta: { colegioId } } }),
    prisma.encuestaRespuesta.findMany({ where: { encuesta: { colegioId } } }),
    prisma.encuestaRespuestaDetalle.findMany({ where: { respuesta: { encuesta: { colegioId } } } }),
    prisma.mensaje.findMany({ where: { conversacion: { colegioId } } }),
    prisma.notificacion.findMany({ where: { OR: [{ usuario: { colegioId } }, { padre: { colegioId } }] } }),
  ]);
  Object.assign(tablas, { secciones, docentesAula, padresEstudiantes, encuestaPreguntas, encuestaRespuestas, encuestaDetalles, mensajes, notificaciones });
  return { colegio, tablas };
}

async function metaUltimoBackup(colegioId: string): Promise<BackupMetaAnterior | null> {
  const ultimo = await prisma.backup.findFirst({ where: { colegioId, estado: BackupEstado.COMPLETADO }, orderBy: { createdAt: 'desc' }, select: { rutaArchivo: true } });
  if (!ultimo) return null;
  const { data, error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(ultimo.rutaArchivo);
  if (error || !data) return null;
  try { return JSON.parse(await data.text())?.meta ?? null; } catch { return null; }
}

async function listarRecursivo(prefix: string): Promise<string[]> {
  const salida: string[] = [];
  const { data, error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`No se pudo listar ${prefix}: ${error.message}`);
  for (const item of data ?? []) {
    const ruta = `${prefix}/${item.name}`;
    if (item.id) salida.push(ruta); else salida.push(...await listarRecursivo(ruta));
  }
  return salida;
}

async function limpiarArchivosSinReferencia(colegioId: string) {
  const vigentes = new Set<string>();
  const backups = await prisma.backup.findMany({ where: { colegioId, estado: BackupEstado.COMPLETADO }, select: { rutaArchivo: true } });
  for (const backup of backups) {
    const { data } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(backup.rutaArchivo);
    if (!data) continue;
    try {
      const parsed = JSON.parse(await data.text());
      for (const archivo of parsed.meta?.archivos ?? []) if (archivo.backupPath) vigentes.add(archivo.backupPath);
    } catch { /* Un JSON roto se detecta en verificación; no autoriza a borrar binarios. */ }
  }
  const existentes = await listarRecursivo(`assets/${colegioId}`);
  const aEliminar = existentes.filter(path => !vigentes.has(path));
  for (let i = 0; i < aEliminar.length; i += 100) {
    const { error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).remove(aEliminar.slice(i, i + 100));
    if (error) throw new Error(`No se pudieron limpiar archivos obsoletos: ${error.message}`);
  }
  if (aEliminar.length) logger.info(`🧹 ${aEliminar.length} archivo(s) sin referencia eliminado(s) del respaldo ${colegioId}`);
}

async function sincronizarArchivos(colegioId: string, fuentes: ArchivoFuente[]) {
  const manifest: ArchivoManifest[] = [];
  const faltantes: ArchivoFuente[] = [];
  for (const fuente of fuentes) {
    const { data, error } = await supabaseAdmin.storage.from(fuente.bucket).download(fuente.path);
    if (error || !data) { faltantes.push(fuente); continue; }
    const contenido = Buffer.from(await data.arrayBuffer());
    const huella = createHash('sha256').update(contenido).digest('hex');
    const nombreSeguro = fuente.path.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'archivo';
    const backupPath = `assets/${colegioId}/${fuente.bucket}/${huella}-${nombreSeguro}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BACKUP_BUCKET).upload(backupPath, contenido, { contentType: data.type || 'application/octet-stream', upsert: false });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw new Error(`No se pudo respaldar ${fuente.bucket}/${fuente.path}: ${uploadError.message}`);
    manifest.push({ ...fuente, backupPath, bytes: contenido.byteLength });
  }
  return { manifest, faltantes };
}

function validarDescensoAnormal(nombre: string, totalActual: number, conteos: Record<string, number>, anterior: BackupMetaAnterior | null) {
  if (totalActual <= 1) throw new Error(`RESPALDO BLOQUEADO: ${nombre} no contiene datos suficientes. Se conserva la última copia válida.`);
  const previo = Number(anterior?.totalRegistros || 0);
  if (previo >= 20 && totalActual < Math.max(5, Math.floor(previo * 0.35))) {
    throw new Error(`RESPALDO BLOQUEADO: caída anormal de ${previo} a ${totalActual} registros. Se conserva la última copia válida.`);
  }
  for (const tabla of ['usuarios', 'estudiantes', 'matriculas']) {
    const antes = Number(anterior?.conteosTablas?.[tabla] || 0), ahora = Number(conteos[tabla] || 0);
    if (antes >= 10 && ahora < Math.floor(antes * 0.2)) {
      throw new Error(`RESPALDO BLOQUEADO: la tabla ${tabla} cayó de ${antes} a ${ahora} registros.`);
    }
  }
}

export async function ejecutarBackup(colegioId?: string, disparadoPorId?: string): Promise<{ ok: boolean; backups: string[]; omitidos: string[]; bloqueados: string[] }> {
  if (ejecucionEnCurso) throw new Error('Ya hay un respaldo en ejecución. Espera a que termine.');
  ejecucionEnCurso = true;
  try { return await ejecutarBackupInterno(colegioId, disparadoPorId); }
  finally { ejecucionEnCurso = false; }
}

async function ejecutarBackupInterno(colegioId?: string, _disparadoPorId?: string): Promise<{ ok: boolean; backups: string[]; omitidos: string[]; bloqueados: string[] }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const colegios = colegioId
    ? await prisma.colegio.findMany({ where: { id: colegioId }, select: { id: true, nombre: true, slug: true } })
    : await prisma.colegio.findMany({ where: { estado: 'ACTIVO' }, select: { id: true, nombre: true, slug: true } });
  if (!colegios.length) throw new Error('No se encontró ningún colegio para respaldar.');
  const generados: string[] = [], omitidos: string[] = [], bloqueados: string[] = [];

  for (const colegio of colegios) {
    const nombre = `backup-${colegio.slug}-${timestamp}.json`, storagePath = `${colegio.id}/${nombre}`;
    let entryId: string | null = null;
    try {
      const snapshot = await crearSnapshot(colegio.id);
      const hashContenido = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
      const anterior = await metaUltimoBackup(colegio.id);
      if (hashContenido === anterior?.hashContenido) {
        omitidos.push(colegio.nombre);
        logger.info(`⏭️ ${colegio.nombre}: sin cambios; no se consume otra versión.`);
        continue;
      }
      const conteosTablas = Object.fromEntries(Object.entries(snapshot.tablas).map(([tabla, filas]) => [tabla, filas.length]));
      const totalRegistros = Object.values(conteosTablas).reduce((n, cantidad) => n + cantidad, snapshot.colegio ? 1 : 0);
      validarDescensoAnormal(colegio.nombre, totalRegistros, conteosTablas, anterior);
      const activos = {
        colegio: snapshot.colegio,
        usuarios: snapshot.tablas.usuarios.filter(x => !x.deletedAt),
        estudiantes: snapshot.tablas.estudiantes.filter(x => !x.deletedAt),
        padres: snapshot.tablas.padres.filter(x => !x.deletedAt),
        pagos: snapshot.tablas.pagos, comunicados: snapshot.tablas.comunicados, documentos: snapshot.tablas.documentos,
      };
      const { manifest, faltantes } = await sincronizarArchivos(colegio.id, extraerArchivos(activos));
      const contenido = { meta: { colegioId: colegio.id, colegioNombre: colegio.nombre, timestamp: new Date().toISOString(), version: '4.0', hashContenido, totalTablas: Object.keys(snapshot.tablas).length, totalRegistros, conteosTablas, archivos: manifest, archivosFaltantes: faltantes }, ...snapshot };
      const buffer = Buffer.from(JSON.stringify(contenido), 'utf-8');
      const entry = await prisma.backup.create({ data: { colegioId: colegio.id, nombre, rutaArchivo: storagePath, estado: BackupEstado.EN_PROCESO } });
      entryId = entry.id;
      const { error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).upload(storagePath, buffer, { contentType: 'application/json', upsert: false });
      if (error) throw new Error(`No se pudo subir el JSON: ${error.message}`);
      const { data: prueba, error: pruebaError } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(storagePath);
      if (pruebaError || !prueba) throw new Error('El JSON subido no pudo volver a descargarse.');
      const verificado = JSON.parse(await prueba.text());
      if (verificado?.meta?.hashContenido !== hashContenido || !verificado?.tablas) throw new Error('El contenido almacenado no coincide con el generado.');
      await prisma.backup.update({ where: { id: entry.id }, data: { estado: BackupEstado.COMPLETADO, tamanoKB: Math.max(1, Math.ceil(buffer.byteLength / 1024)), error: faltantes.length ? `${faltantes.length} archivo(s) ya no existían y fueron omitidos.` : null } });
      generados.push(nombre);
      logger.info(`✅ Backup verificado: ${nombre} · ${totalRegistros} registros · ${manifest.length} archivos vigentes`);
    } catch (err) {
      if ((err as Error).message.startsWith('RESPALDO BLOQUEADO:')) bloqueados.push(`${colegio.nombre}: ${(err as Error).message.replace('RESPALDO BLOQUEADO: ', '')}`);
      if (entryId) await prisma.backup.update({ where: { id: entryId }, data: { estado: BackupEstado.FALLIDO, error: (err as Error).message } }).catch(() => {});
      await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([storagePath]).catch(() => {});
      logger.error(`❌ Backup fallido: ${nombre}`, err);
    }
  }
  await rotarBackups(colegioId);
  return { ok: generados.length > 0 || omitidos.length > 0, backups: generados, omitidos, bloqueados };
}

async function rotarBackups(colegioId?: string) {
  try {
    const colegios = colegioId ? [{ id: colegioId }] : await prisma.colegio.findMany({ select: { id: true } });
    for (const colegio of colegios) {
      const backups = await prisma.backup.findMany({ where: { colegioId: colegio.id, estado: BackupEstado.COMPLETADO }, orderBy: { createdAt: 'desc' } });
      for (const backup of backups.slice(BACKUP_MAX)) {
        const { error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([backup.rutaArchivo]);
        if (error) { logger.warn(`No se eliminó ${backup.rutaArchivo}; se conserva su registro.`, error); continue; }
        await prisma.backup.delete({ where: { id: backup.id } });
      }
      await limpiarArchivosSinReferencia(colegio.id);
    }
  } catch (err) { logger.warn('Error en rotación de backups', err); }
}

export async function urlDescargaBackup(rutaArchivo: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).createSignedUrl(rutaArchivo, 300);
  if (error || !data) throw new Error(error?.message ?? 'No se pudo generar el enlace de descarga');
  return data.signedUrl;
}

const ORDEN_RESTAURACION: Array<[string, string]> = [
  ['usuarios', 'usuario'], ['nivelesGrados', 'nivelGrado'], ['secciones', 'seccion'], ['aulas', 'aula'],
  ['cursos', 'curso'], ['estudiantes', 'estudiante'], ['padres', 'padre'], ['padresEstudiantes', 'padreEstudiante'],
  ['matriculas', 'matricula'], ['docentesAula', 'docenteAula'], ['horarios', 'horario'], ['conceptosPago', 'conceptoPago'],
  ['pagos', 'pago'], ['notas', 'nota'], ['recuperaciones', 'recuperacion'], ['asistencias', 'asistencia'],
  ['comunicados', 'comunicado'], ['eventos', 'evento'], ['encuestas', 'encuesta'], ['encuestaPreguntas', 'encuestaPregunta'],
  ['encuestaRespuestas', 'encuestaRespuesta'], ['encuestaDetalles', 'encuestaRespuestaDetalle'], ['observaciones', 'observacion'],
  ['permisosSalida', 'permisoSalida'], ['documentos', 'documento'], ['conversaciones', 'conversacion'], ['mensajes', 'mensaje'],
  ['chatbotPreguntas', 'chatbotPregunta'], ['notificaciones', 'notificacion'], ['auditoria', 'auditoria'],
  ['exportaciones', 'exportacion'], ['licencias', 'licencia'], ['pagosLicencia', 'pagoLicencia'],
];

export async function restaurarBackupSeguro(rutaArchivo: string, colegioId: string) {
  const { data, error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(rutaArchivo);
  if (error || !data) throw new Error(`No se pudo leer el respaldo: ${error?.message || 'archivo no disponible'}`);
  const parsed = JSON.parse(await data.text());
  const snapshot = { colegio: parsed.colegio, tablas: parsed.tablas };
  const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  if (!parsed.tablas || parsed.meta?.colegioId !== colegioId || hash !== parsed.meta?.hashContenido) {
    throw new Error('El respaldo no superó la validación de integridad o pertenece a otro colegio.');
  }

  let archivosRestaurados = 0;
  for (const archivo of (parsed.meta?.archivos ?? []) as ArchivoManifest[]) {
    const { data: existente } = await supabaseAdmin.storage.from(archivo.bucket).download(archivo.path);
    if (existente) continue; // nunca reemplaza una versión actual válida
    const { data: binario, error: binarioError } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(archivo.backupPath);
    if (binarioError || !binario) throw new Error(`Falta el binario respaldado ${archivo.backupPath}.`);
    const buffer = Buffer.from(await binario.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage.from(archivo.bucket).upload(archivo.path, buffer, { contentType: binario.type || 'application/octet-stream', upsert: false });
    if (uploadError) throw new Error(`No se pudo restaurar ${archivo.bucket}/${archivo.path}: ${uploadError.message}`);
    archivosRestaurados++;
  }

  const insertados: Record<string, number> = {}, reactivados: Record<string, number> = {};
  await prisma.$transaction(async tx => {
    for (const [tabla, delegate] of ORDEN_RESTAURACION) {
      const filas = Array.isArray(parsed.tablas[tabla]) ? parsed.tablas[tabla] : [];
      if (!filas.length) continue;
      const modelo = (tx as any)[delegate];
      const resultado = await modelo.createMany({ data: filas, skipDuplicates: true });
      insertados[tabla] = resultado.count;
      if (filas.some((fila: any) => Object.prototype.hasOwnProperty.call(fila, 'deletedAt'))) {
        const ids = filas.filter((fila: any) => fila.id).map((fila: any) => fila.id);
        const activos = await modelo.updateMany({ where: { id: { in: ids }, deletedAt: { not: null } }, data: { deletedAt: null } });
        if (activos.count) reactivados[tabla] = activos.count;
      }
    }
  }, { timeout: 120000 });
  return { modo: 'FUSION_SEGURA', insertados, reactivados, archivosRestaurados, registrosFuente: parsed.meta.totalRegistros };
}
