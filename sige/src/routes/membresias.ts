// src/routes/membresias.ts — SIGE V8.1
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isSuperAdmin, isAdminDir } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { AppError } from '../utils/AppError';
import { auditar } from '../middleware/auditoria';
import { AuditoriaAccion, Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate, resolveTenant);

const planSchema = z.object({
  nombre:              z.string().min(2),
  descripcion:         z.string().optional().nullable(),
  precio:              z.coerce.number().min(0),
  duracionDias:        z.coerce.number().int().min(1).default(30),
  maxEstudiantes:      z.coerce.number().int().min(1),
  maxUsuarios:         z.coerce.number().int().min(1),
  maxAlmacenamientoGB: z.coerce.number().min(0.1),
  modulosActivos:      z.array(z.string()).optional(),
  rolesHabilitados:    z.array(z.string()).optional(),
  observaciones:       z.string().optional().nullable(),
});

// ── PLANES ────────────────────────────────────────────────────────────────────
router.get('/planes', async (_req, res) => {
  const planes = await prisma.plan.findMany({ orderBy: { precio: 'asc' } });
  res.json({ ok: true, data: planes });
});

router.get('/planes/:id', isSuperAdmin, async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) throw new AppError('Plan no encontrado', 404);
  res.json({ ok: true, data: plan });
});

router.post('/planes', isSuperAdmin, auditar({ modulo: 'PLANES', accion: AuditoriaAccion.CREAR }), async (req, res) => {
  const data = planSchema.parse(req.body);
  const existe = await prisma.plan.findFirst({ where: { nombre: { equals: data.nombre, mode: 'insensitive' } } });
  if (existe) throw new AppError(`Ya existe un plan llamado "${data.nombre}"`, 409);
  const plan = await prisma.plan.create({ data: { ...data, modulosActivos: data.modulosActivos ?? ['ALL'], rolesHabilitados: data.rolesHabilitados ?? [] } as Prisma.PlanCreateInput });
  res.status(201).json({ ok: true, data: plan });
});

router.patch('/planes/:id', isSuperAdmin, auditar({ modulo: 'PLANES', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }), async (req, res) => {
  const data = planSchema.partial().extend({ activo: z.boolean().optional() }).parse(req.body);
  const planActual = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!planActual) throw new AppError('Plan no encontrado', 404);
  if (data.nombre && data.nombre.toLowerCase() !== planActual.nombre.toLowerCase()) {
    const dup = await prisma.plan.findFirst({ where: { nombre: { equals: data.nombre, mode: 'insensitive' }, id: { not: req.params.id } } });
    if (dup) throw new AppError(`Ya existe un plan llamado "${data.nombre}"`, 409);
  }
  const plan = await prisma.plan.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, data: plan });
});

router.patch('/planes/:id/toggle', isSuperAdmin, async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) throw new AppError('Plan no encontrado', 404);
  if (plan.activo) {
    const enUso = await prisma.colegio.count({ where: { planId: req.params.id, estado: 'ACTIVO' } });
    if (enUso > 0) throw new AppError(`No se puede desactivar: ${enUso} colegio(s) activo(s) usan este plan`, 409);
  }
  const updated = await prisma.plan.update({ where: { id: req.params.id }, data: { activo: !plan.activo } });
  res.json({ ok: true, data: updated });
});

router.delete('/planes/:id', isSuperAdmin, async (req, res) => {
  const enUso = await prisma.colegio.count({ where: { planId: req.params.id } });
  if (enUso > 0) throw new AppError(`No se puede eliminar: ${enUso} colegio(s) usan este plan`, 409);
  await prisma.plan.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ── MI PLAN ────────────────────────────────────────────────────────────────────
router.get('/mi-plan', isAdminDir, async (req, res) => {
  const colegioId = req.user!.colegioId;
  if (!colegioId) throw new AppError('Sin colegio asignado', 404);
  const colegio = await prisma.colegio.findUnique({
    where: { id: colegioId },
    include: { plan: true, _count: { select: { estudiantes: { where: { deletedAt: null } }, usuarios: { where: { activo: true } } } } },
  });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  const diasRestantes = colegio.licenciaFin ? Math.ceil((colegio.licenciaFin.getTime() - Date.now()) / 86400000) : null;
  res.json({ ok: true, data: { plan: colegio.plan, licenciaInicio: colegio.licenciaInicio, licenciaFin: colegio.licenciaFin, diasRestantes, alertaVencimiento: diasRestantes !== null && diasRestantes <= 30, uso: { estudiantes: colegio._count.estudiantes, maxEstudiantes: colegio.plan.maxEstudiantes, usuarios: colegio._count.usuarios, maxUsuarios: colegio.plan.maxUsuarios, almacenamientoMB: colegio.almacenamientoUsadoMB, maxAlmacenamientoMB: colegio.plan.maxAlmacenamientoGB * 1024 } } });
});

// ── LICENCIAS ─────────────────────────────────────────────────────────────────
router.get('/licencias/:colegioId', isSuperAdmin, async (req, res) => {
  const licencias = await prisma.licencia.findMany({ where: { colegioId: req.params.colegioId }, orderBy: { createdAt: 'desc' } });
  res.json({ ok: true, data: licencias });
});

router.post('/licencias', isSuperAdmin, auditar({ modulo: 'LICENCIAS', accion: AuditoriaAccion.RENOVAR }), async (req, res) => {
  const { colegioId, planId, dias, estado, motivo } = z.object({
    colegioId: z.string(), planId: z.string().optional(),
    dias: z.coerce.number().int().min(1).max(3650).default(30),
    estado: z.enum(['ACTIVA','PRUEBA','SUSPENDIDA','VENCIDA']).default('ACTIVA'),
    motivo: z.string().optional().nullable(),
  }).parse(req.body);
  const colegio = await prisma.colegio.findUnique({ where: { id: colegioId } });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  const inicio = new Date();
  const fin = new Date();
  fin.setDate(fin.getDate() + dias);
  const licencia = await prisma.licencia.create({ data: { colegioId, planId: planId ?? colegio.planId, estado, fechaInicio: inicio, fechaFin: fin, motivo, creadoPorId: req.user!.id } as Prisma.LicenciaUncheckedCreateInput });
  await prisma.colegio.update({ where: { id: colegioId }, data: { planId: planId ?? colegio.planId, licenciaInicio: inicio, licenciaFin: fin, estado: estado === 'SUSPENDIDA' ? 'SUSPENDIDO' : 'ACTIVO' } });
  res.status(201).json({ ok: true, data: licencia });
});

router.patch('/licencias/:colegioId/suspender', isSuperAdmin, auditar({ modulo: 'LICENCIAS', accion: AuditoriaAccion.SUSPENDER, getRecursoId: r => r.params.colegioId }), async (req, res) => {
  const { motivo } = z.object({ motivo: z.string().optional() }).parse(req.body);
  const colegio = await prisma.colegio.findUnique({ where: { id: req.params.colegioId } });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  await prisma.colegio.update({ where: { id: req.params.colegioId }, data: { estado: 'SUSPENDIDO' } });
  await prisma.licencia.create({ data: { colegioId: req.params.colegioId, planId: colegio.planId, estado: 'SUSPENDIDA', fechaFin: new Date(), motivo: motivo ?? 'Suspendida manualmente', creadoPorId: req.user!.id } as Prisma.LicenciaUncheckedCreateInput });
  res.json({ ok: true });
});

router.patch('/licencias/:colegioId/reactivar', isSuperAdmin, auditar({ modulo: 'LICENCIAS', accion: AuditoriaAccion.RESTAURAR, getRecursoId: r => r.params.colegioId }), async (req, res) => {
  await prisma.colegio.update({ where: { id: req.params.colegioId }, data: { estado: 'ACTIVO' } });
  res.json({ ok: true });
});

// ── RENOVAR — siempre desde HOY ───────────────────────────────────────────────
router.post('/renovar/:colegioId', isSuperAdmin, auditar({ modulo: 'LICENCIAS', accion: AuditoriaAccion.RENOVAR, getRecursoId: r => r.params.colegioId }), async (req, res) => {
  const { planId, meses = 1 } = z.object({ planId: z.string().optional(), meses: z.coerce.number().int().min(1).max(36).default(1) }).parse(req.body);
  const colegio = await prisma.colegio.findUnique({ where: { id: req.params.colegioId } });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  // SIEMPRE desde hoy — no se suman días del periodo anterior
  const inicio = new Date();
  const fin = new Date();
  fin.setMonth(fin.getMonth() + meses);
  await prisma.colegio.update({ where: { id: req.params.colegioId }, data: { planId: planId ?? colegio.planId, licenciaInicio: inicio, licenciaFin: fin, estado: 'ACTIVO' } });
  await prisma.licencia.create({ data: { colegioId: req.params.colegioId, planId: planId ?? colegio.planId, estado: 'ACTIVA', fechaInicio: inicio, fechaFin: fin, motivo: `Renovación ${meses} mes(es) — desde ${inicio.toLocaleDateString('es-PE')}`, creadoPorId: req.user!.id } as Prisma.LicenciaUncheckedCreateInput });
  res.json({ ok: true, licenciaFin: fin, diasRestantes: Math.ceil((fin.getTime() - Date.now()) / 86400000) });
});

// ── ALERTAS ───────────────────────────────────────────────────────────────────
router.get('/alertas', isSuperAdmin, async (_req, res) => {
  const en30dias = new Date();
  en30dias.setDate(en30dias.getDate() + 30);
  const colegios = await prisma.colegio.findMany({ where: { estado: { in: ['ACTIVO','PRUEBA'] }, licenciaFin: { lte: en30dias } }, include: { plan: { select: { nombre: true } } }, orderBy: { licenciaFin: 'asc' } });
  res.json({ ok: true, data: colegios });
});

export default router;
