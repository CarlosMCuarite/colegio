// src/services/backupService.ts
import cron from 'node-cron';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { BackupEstado } from '@prisma/client';
import { supabaseAdmin, BUCKETS } from '../config/supabase';

const BACKUP_BUCKET = process.env.SUPABASE_STORAGE_BUCKET_BACKUPS || 'backups';
const BACKUP_MAX    = parseInt(process.env.BACKUP_MAX_VERSIONES || '7', 10);
const BACKUP_CRON   = process.env.BACKUP_CRON || '0 * * * *'; // Cada hora

export function initBackupCron(): void {
  if (!cron.validate(BACKUP_CRON)) {
    throw new Error(`BACKUP_CRON inválido: "${BACKUP_CRON}"`);
  }
  let ejecutando = false;
  const timezone = process.env.BACKUP_TIMEZONE || 'America/Lima';
  cron.schedule(BACKUP_CRON, async () => {
    if (ejecutando) {
      logger.warn('Backup omitido: la ejecución anterior todavía continúa.');
      return;
    }
    ejecutando = true;
    logger.info('🔄 Iniciando backup programado...');
    try {
      await ejecutarBackup();
    } finally {
      ejecutando = false;
    }
  }, { timezone });
  logger.info(`✅ Backup cron iniciado [${BACKUP_CRON}] (${timezone}) — retención: ${BACKUP_MAX} versiones — bucket: ${BACKUP_BUCKET}`);
}

/**
 * Genera un respaldo completo del colegio (o de todos los colegios activos)
 * y lo sube a Supabase Storage — NUNCA a disco local, que se pierde en cada
 * redeploy de la plataforma. El respaldo incluye todas las tablas de datos
 * más las URLs de los archivos ya alojados en Storage (logos, documentos,
 * vouchers, fotos) — como esos archivos ya viven de forma duradera en
 * Supabase Storage, respaldar sus URLs junto con los registros es suficiente
 * para poder recuperarlos; no es necesario duplicar los binarios.
 */
export async function ejecutarBackup(colegioId?: string, disparadoPorId?: string): Promise<{ ok: boolean; backups: string[] }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const colegios = colegioId
    ? await prisma.colegio.findMany({ where: { id: colegioId }, select: { id: true, nombre: true, slug: true } })
    : await prisma.colegio.findMany({ where: { estado: 'ACTIVO' }, select: { id: true, nombre: true, slug: true } });

  const generados: string[] = [];

  for (const colegio of colegios) {
    const nombre = `backup-${colegio.slug}-${timestamp}.json`;
    const storagePath = `${colegio.id}/${nombre}`;

    const backupEntry = await prisma.backup.create({
      data: { colegioId: colegio.id, nombre, rutaArchivo: storagePath, estado: BackupEstado.EN_PROCESO },
    });

    try {
      const [
        colegioCompleto, estudiantes, padres, matriculas, asistencias, pagos,
        comunicados, documentos, eventos, encuestas, horarios, usuarios,
      ] = await Promise.all([
        prisma.colegio.findUnique({ where: { id: colegio.id } }),
        prisma.estudiante.findMany({ where: { colegioId: colegio.id } }),
        prisma.padre.findMany({ where: { colegioId: colegio.id } }),
        prisma.matricula.findMany({ where: { colegioId: colegio.id } }),
        prisma.asistencia.findMany({ where: { colegioId: colegio.id }, orderBy: { fecha: 'desc' }, take: 10000 }),
        prisma.pago.findMany({ where: { colegioId: colegio.id } }),
        prisma.comunicado.findMany({ where: { colegioId: colegio.id } }),
        prisma.documento.findMany({ where: { colegioId: colegio.id } }),
        prisma.evento.findMany({ where: { colegioId: colegio.id } }),
        prisma.encuesta.findMany({ where: { colegioId: colegio.id }, include: { preguntas: true } }),
        prisma.horario.findMany({ where: { colegioId: colegio.id } }),
        prisma.usuario.findMany({ where: { colegioId: colegio.id }, select: { id: true, nombres: true, apellidos: true, email: true, rol: true, activo: true, telefono: true, dni: true, avatarUrl: true } }),
      ]);

      const data = {
        meta: { colegioId: colegio.id, colegioNombre: colegio.nombre, timestamp: new Date().toISOString(), version: '2.0' },
        colegio: colegioCompleto,
        usuarios, estudiantes, padres, matriculas, asistencias, pagos,
        comunicados, documentos, eventos, encuestas, horarios,
      };

      const jsonContent = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonContent, 'utf-8');

      const { error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).upload(storagePath, buffer, {
        contentType: 'application/json',
        upsert: true,
      });
      if (error) {
        const detalle = (error as any).statusCode ? ` (HTTP ${(error as any).statusCode})` : '';
        throw new Error(`${error.message}${detalle} — bucket="${BACKUP_BUCKET}". Revisa: 1) el bucket existe en Supabase Storage (docs/SUPABASE_STORAGE_SETUP.sql), 2) SUPABASE_SERVICE_ROLE_KEY en .env es la clave "service_role" real (Project Settings → API), no la "anon".`);
      }

      // ── Copia real de los archivos (no solo sus URLs) ────────────────────
      // Duplica dentro del bucket de backups los archivos que la BD referencia,
      // para poder recuperarlos aunque el archivo original se borre o sobrescriba
      // por accidente. Se copia dentro de Supabase Storage (server-side, sin
      // descargar/resubir por nuestro backend) a la carpeta
      // `{colegioId}/{timestamp}/archivos/...`.
      const carpetaArchivos = `${colegio.id}/${timestamp}/archivos`;
      const rutasACopiar: Array<{ bucket: string; origen: string }> = [];

      const extraerPath = (url: string | null | undefined, bucket: string): string | null => {
        if (!url) return null;
        const marcador = `/${bucket}/`;
        const idx = url.indexOf(marcador);
        return idx === -1 ? null : url.slice(idx + marcador.length);
      };

      if (colegioCompleto?.logoUrl) {
        const p = extraerPath(colegioCompleto.logoUrl, BUCKETS.LOGOS);
        if (p) rutasACopiar.push({ bucket: BUCKETS.LOGOS, origen: p });
      }
      documentos.forEach(d => {
        const p = extraerPath(d.archivoUrl, BUCKETS.DOCUMENTOS);
        if (p) rutasACopiar.push({ bucket: BUCKETS.DOCUMENTOS, origen: p });
      });
      comunicados.forEach(c => {
        const p = extraerPath(c.adjuntoUrl, BUCKETS.DOCUMENTOS);
        if (p) rutasACopiar.push({ bucket: BUCKETS.DOCUMENTOS, origen: p });
      });

      let archivosCopiados = 0;
      for (const { bucket, origen } of rutasACopiar) {
        try {
          const { error: copyErr } = await supabaseAdmin.storage
            .from(bucket)
            .copy(origen, `${carpetaArchivos}/${bucket}/${origen}`, { destinationBucket: BACKUP_BUCKET } as any);
          if (!copyErr) archivosCopiados++;
        } catch { /* si un archivo puntual falla, no abortar todo el backup */ }
      }

      const tamanoKB = Math.round(buffer.byteLength / 1024);
      await prisma.backup.update({
        where: { id: backupEntry.id },
        data: { estado: BackupEstado.COMPLETADO, tamanoKB },
      });

      generados.push(nombre);
      logger.info(`✅ Backup completado: ${nombre} (${tamanoKB} KB, ${archivosCopiados}/${rutasACopiar.length} archivos duplicados) → Storage`);
    } catch (err) {
      await prisma.backup.update({
        where: { id: backupEntry.id },
        data: { estado: BackupEstado.FALLIDO, error: (err as Error).message },
      });
      logger.error(`❌ Backup fallido: ${nombre}`, err);
    }
  }

  await rotarBackups(colegioId);
  return { ok: true, backups: generados };
}

/** Mantiene solo las BACKUP_MAX versiones más recientes por colegio, en Storage */
async function rotarBackups(colegioId?: string): Promise<void> {
  try {
    const colegios = colegioId
      ? [{ id: colegioId }]
      : await prisma.colegio.findMany({ select: { id: true } });

    for (const colegio of colegios) {
      const backups = await prisma.backup.findMany({
        where: { colegioId: colegio.id, estado: 'COMPLETADO' },
        orderBy: { createdAt: 'desc' },
      });
      const aEliminar = backups.slice(BACKUP_MAX);
      for (const b of aEliminar) {
        await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([b.rutaArchivo]).catch(() => {});
        await prisma.backup.delete({ where: { id: b.id } }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn('Error en rotación de backups', err);
  }
}

/** Genera una URL firmada temporal para descargar un backup específico */
export async function urlDescargaBackup(rutaArchivo: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).createSignedUrl(rutaArchivo, 300); // 5 min
  if (error || !data) throw new Error(error?.message ?? 'No se pudo generar el enlace de descarga');
  return data.signedUrl;
}
