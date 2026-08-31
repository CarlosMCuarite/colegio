// src/routes/auditoria.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isSuperAdmin, isAdminDir } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { AuditoriaAccion, RolNombre } from '@prisma/client';
import { limpiarAuditoriaAntigua } from '../services/auditoriaRetentionService';

const router = Router();
router.use(authenticate, resolveTenant);

// ── GET /auditoria ────────────────────────────────────────────────────────────
router.get('/', isAdminDir, async (req, res) => {
  const { usuarioId, modulo, accion, desde, hasta, page = '1', limit = '50' } = req.query as Record<string,string>;

  const where: any = {};
  if (req.user!.rol !== RolNombre.SUPERADMIN) {
    where.colegioId = req.user!.colegioId;
  } else if (req.colegioId) {
    where.colegioId = req.colegioId;
  }
  // Superadmin sin colegioId ve TODO

  if (usuarioId) where.usuarioId = usuarioId;
  if (modulo)    where.modulo    = { contains: modulo, mode: 'insensitive' };
  if (accion)    where.accion    = accion as AuditoriaAccion;
  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt.gte = new Date(desde);
    if (hasta) where.createdAt.lte = new Date(hasta + 'T23:59:59');
  }

  const skip = (parseInt(page)-1) * parseInt(limit);
  const [total, registros] = await Promise.all([
    prisma.auditoria.count({ where }),
    prisma.auditoria.findMany({
      where, skip, take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        usuario: { select: { nombres: true, apellidos: true, rol: true, email: true } },
        colegio: { select: { nombre: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: registros, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
});

// ── GET /auditoria/global — Solo Superadmin ───────────────────────────────────
router.get('/global', isSuperAdmin, async (req, res) => {
  const { page = '1', limit = '100', colegioId } = req.query as Record<string,string>;
  const where: any = {};
  if (colegioId) where.colegioId = colegioId;

  const [total, registros] = await Promise.all([
    prisma.auditoria.count({ where }),
    prisma.auditoria.findMany({
      where,
      skip: (parseInt(page)-1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        usuario: { select: { nombres: true, apellidos: true, rol: true } },
        colegio: { select: { nombre: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: registros, meta: { total } });
});

// ── GET /auditoria/resumen ────────────────────────────────────────────────────
router.get('/resumen', isAdminDir, async (req, res) => {
  const user = req.user!;
  const colegioId = user.rol !== RolNombre.SUPERADMIN ? user.colegioId : req.colegioId;
  const where: any = {};
  if (colegioId) where.colegioId = colegioId;

  const hace30dias = new Date();
  hace30dias.setDate(hace30dias.getDate() - 30);
  where.createdAt = { gte: hace30dias };

  const [porModulo, porAccion] = await Promise.all([
    prisma.auditoria.groupBy({ by: ['modulo'], where, _count: true, orderBy: { _count: { modulo: 'desc' } }, take: 10 }),
    prisma.auditoria.groupBy({ by: ['accion'], where, _count: true }),
  ]);
  res.json({ ok: true, data: { porModulo, porAccion } });
});

// Limpieza segura: aplica únicamente la política de retención configurada.
// Nunca elimina registros recientes ni permite escoger un rango arbitrario.
router.post('/limpiar-vencidos', isSuperAdmin, async (_req, res) => {
  const eliminados = await limpiarAuditoriaAntigua();
  res.json({ ok: true, data: { eliminados } });
});

export default router;
