// src/routes/backups.ts
import { Router } from 'express';
import prisma from '../config/prisma';
import { authenticate, isSuperAdmin } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion } from '@prisma/client';
import { ejecutarBackup, urlDescargaBackup } from '../services/backupService';
import { supabaseAdmin } from '../config/supabase';
import { BUCKETS } from '../config/supabase';

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

  const carpeta = backup.rutaArchivo.split('/').slice(0, -1).join('/');

  const { data: jsonData, error: jsonError } = await supabaseAdmin.storage
    .from(BUCKETS.BACKUPS)
    .download(backup.rutaArchivo);

  let jsonValido = false;
  let registros = 0;
  if (!jsonError && jsonData) {
    try {
      const texto = await jsonData.text();
      const parsed = JSON.parse(texto);
      jsonValido = true;
      registros = (parsed.estudiantes?.length ?? 0) + (parsed.padres?.length ?? 0) + (parsed.usuarios?.length ?? 0);
    } catch { jsonValido = false; }
  }

  const { data: archivosCarpeta } = await supabaseAdmin.storage
    .from(BUCKETS.BACKUPS)
    .list(`${carpeta}/archivos`, { limit: 1000 });

  res.json({
    ok: true,
    data: {
      jsonValido,
      registrosEnJson: registros,
      archivosRespaldados: archivosCarpeta?.length ?? 0,
      recuperable: jsonValido,
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
    const { error } = await supabaseAdmin.storage.from(BUCKETS.BACKUPS).download(b.rutaArchivo);
    if (error) {
      await prisma.backup.delete({ where: { id: b.id } }).catch(() => {});
      purgados++;
    }
  }
  res.json({ ok: true, purgados, revisados: backups.length });
});

// ── DELETE /backups/:id ───────────────────────────────────────────────────────
router.delete(
  '/:id',
  auditar({ modulo: 'BACKUPS', accion: AuditoriaAccion.ELIMINAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const backup = await prisma.backup.findUnique({ where: { id: req.params.id } });
    if (!backup) throw new AppError('Backup no encontrado', 404);
    await supabaseAdmin.storage.from(BUCKETS.BACKUPS).remove([backup.rutaArchivo]).catch(() => {});
    await prisma.backup.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  },
);

export default router;
