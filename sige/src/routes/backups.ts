// src/routes/backups.ts
import { Router } from 'express';
import prisma from '../config/prisma';
import { authenticate, isSuperAdmin } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, BackupEstado } from '@prisma/client';
import { BACKUP_BUCKET, ejecutarBackup, restaurarBackupSeguro, urlDescargaBackup } from '../services/backupService';
import { supabaseAdmin } from '../config/supabase';
import { createHash } from 'crypto';

const router = Router();
router.use(authenticate, resolveTenant, isSuperAdmin);

// ── GET /backups — Listado de todos los respaldos (todos los colegios) ───────
router.get('/', async (req, res) => {
  const { colegioId, page = '1', limit = '30' } = req.query as Record<string,string>;
  const where: any = {};
  if (colegioId) where.colegioId = colegioId;

  const [total, backups] = await Promise.all([
    prisma.backup.count({ where }),
    prisma.backup.findMany({
      where,
      skip: (parseInt(page)-1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { colegio: { select: { nombre: true, slug: true } } },
    }),
  ]);
  res.json({ ok: true, data: backups, meta: { total } });
});

// ── POST /backups — Disparar un respaldo manual ───────────────────────────────
router.post(
  '/',
  auditar({ modulo: 'BACKUPS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const { colegioId } = req.body as { colegioId?: string };
    const resultado = await ejecutarBackup(colegioId, req.user!.id);
    res.status(201).json({ ok: true, data: resultado });
  },
);

// ── GET /backups/:id/descargar — URL firmada temporal (5 min) ────────────────
router.get('/:id/descargar', async (req, res) => {
  const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
  if (!backup) throw new AppError('Backup no encontrado', 404);
  if (backup.estado !== 'COMPLETADO') throw new AppError('Este backup no está disponible para descarga', 409);
  const url = await urlDescargaBackup(backup.rutaArchivo);
  res.json({ ok: true, url });
});

// ── GET /backups/:id/verificar — Comprueba que el backup sea recuperable ─────
// Verifica de verdad: 1) el JSON existe y es parseable en Storage,
// 2) los archivos copiados (logos/documentos) también existen ahí.
// No es solo un chequeo de metadata — hace las llamadas reales a Storage.
router.get('/:id/verificar', async (req, res) => {
  const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
  if (!backup) throw new AppError('Backup no encontrado', 404);

  const { data: jsonData, error: jsonError } = await supabaseAdmin.storage
    .from(BACKUP_BUCKET)
    .download(backup.rutaArchivo);

  let jsonValido = false;
  let integridadValida = false;
  let registros = 0;
  let archivosRespaldados = 0;
  let archivosFaltantes = 0;
  let archivosNoDisponibles = 0;
  if (!jsonError && jsonData) {
    try {
      const texto = await jsonData.text();
      const parsed = JSON.parse(texto);
      jsonValido = true;
      const snapshot = { colegio: parsed.colegio, tablas: parsed.tablas };
      const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
      integridadValida = !!parsed.tablas && hash === parsed.meta?.hashContenido;
      registros = parsed.meta?.totalRegistros ?? Object.values(parsed.tablas ?? {}).reduce((n: number, rows: any) => n + (Array.isArray(rows) ? rows.length : 0), parsed.colegio ? 1 : 0);
      const manifest = Array.isArray(parsed.meta?.archivos) ? parsed.meta.archivos : [];
      archivosRespaldados = manifest.length;
      archivosFaltantes = Array.isArray(parsed.meta?.archivosFaltantes) ? parsed.meta.archivosFaltantes.length : 0;
      for (const archivo of manifest) {
        const { error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(archivo.backupPath);
        if (error) archivosNoDisponibles++;
      }
    } catch { jsonValido = false; }
  }

  res.json({
    ok: true,
    data: {
      jsonValido,
      integridadValida,
      registrosEnJson: registros,
      archivosRespaldados,
      archivosFaltantes,
      archivosNoDisponibles,
      recuperable: jsonValido && integridadValida && archivosNoDisponibles === 0,
    },
  });
});

// ── POST /backups/purgar-rotos — Elimina de la base de datos los registros ───
// de backups "Completado" cuyo archivo YA NO EXISTE en Storage (por ejemplo,
// si el bucket se borró/recreó manualmente desde el panel de Supabase). Antes
// de borrar cada registro, confirma con una llamada real a Storage.
router.post('/purgar-rotos', async (req, res) => {
  const backups = await prisma.backup.findMany({ where: { estado: 'COMPLETADO' } });
  let purgados = 0;
  for (const b of backups) {
    const { error } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(b.rutaArchivo);
    if (error) {
      await prisma.backup.delete({ where: { id: b.id } }).catch(() => {});
      purgados++;
    }
  }
  res.json({ ok: true, purgados, revisados: backups.length });
});

// Restaura por fusión: inserta únicamente datos faltantes, reactiva registros
// eliminados lógicamente y nunca reemplaza datos ni archivos actuales.
router.post(
  '/:id/restaurar',
  auditar({ modulo: 'BACKUPS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    if (req.body?.confirmacion !== 'RESTAURAR SIN BORRAR') throw new AppError('Confirmación de restauración inválida', 400);
    const backup = await prisma.backup.findUnique({ where: { id: req.params.id }, include: { colegio: { select: { nombre: true } } } });
    if (!backup) throw new AppError('Backup no encontrado', 404);
    if (backup.estado !== BackupEstado.COMPLETADO) throw new AppError('Solo se puede restaurar un backup completado', 409);
    const resultado = await restaurarBackupSeguro(backup.rutaArchivo, backup.colegioId);
    res.json({ ok: true, message: `Restauración segura completada para ${backup.colegio.nombre}. No se eliminó ni sobrescribió información actual.`, data: resultado });
  },
);

// ── DELETE /backups/:id ───────────────────────────────────────────────────────
router.delete(
  '/:id',
  auditar({ modulo: 'BACKUPS', accion: AuditoriaAccion.ELIMINAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
    if (!backup) throw new AppError('Backup no encontrado', 404);
    await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([backup.rutaArchivo]).catch(() => {});
    await prisma.backup.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  },
);

export default router;
