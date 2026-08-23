// src/routes/aulas.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isAdmin } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { AppError } from '../utils/AppError';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

// ═══════════════════════════════════════════════════════════════════════════
// AULAS — salones físicos del colegio (independientes de una sección fija)
// ═══════════════════════════════════════════════════════════════════════════

const aulaSchema = z.object({
  nombre:         z.string().min(2),
  seccionId:      z.string().optional().nullable(),
  docenteTutorId: z.string().optional().nullable(),
  capacidad:      z.coerce.number().int().positive().optional().nullable(),
});

// ── GET /aulas — lista con búsqueda ────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId!, activo: true };
  if (q) where.nombre = { contains: q, mode: 'insensitive' };

  const aulas = await prisma.aula.findMany({
    where,
    include: {
      seccion:      { include: { nivelGrado: true } },
      docenteTutor: { select: { id: true, nombres: true, apellidos: true } },
    },
    orderBy: { nombre: 'asc' },
  });
  res.json({ ok: true, data: aulas });
});

router.get('/niveles-grados', async (req, res) => {
  const niveles = await prisma.nivelGrado.findMany({
    where: { colegioId: req.colegioId!, activo: true },
    include: { secciones: { where: { activo: true } } },
    orderBy: [{ nivel: 'asc' }, { grado: 'asc' }],
  });
  res.json({ ok: true, data: niveles });
});

// ── GET /aulas/docentes-disponibles — para elegir tutor ────────────────────
router.get('/docentes-disponibles', async (req, res) => {
  const docentes = await prisma.usuario.findMany({
    where: { colegioId: req.colegioId!, activo: true, rol: { in: ['DOCENTE','AUXILIAR','TUTOR','COORDINADOR'] } },
    select: { id: true, nombres: true, apellidos: true, rol: true },
    orderBy: { apellidos: 'asc' },
  });
  res.json({ ok: true, data: docentes });
});

router.post('/', isAdmin, async (req, res) => {
  const data = aulaSchema.parse(req.body);
  const aula = await prisma.aula.create({ data: { ...data, colegioId: req.colegioId! } as Prisma.AulaUncheckedCreateInput });
  res.status(201).json({ ok: true, data: aula });
});

router.patch('/:id', isAdmin, async (req, res) => {
  const data = aulaSchema.partial().extend({ activo: z.boolean().optional() }).parse(req.body);
  const updated = await prisma.aula.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data });
  if (updated.count === 0) throw new AppError('Aula no encontrada', 404);
  res.json({ ok: true });
});

// ── DELETE /aulas/:id — baja lógica ────────────────────────────────────────
router.delete('/:id', isAdmin, async (req, res) => {
  const enUso = await prisma.horario.count({ where: { aulaId: req.params.id, activo: true } });
  if (enUso > 0) throw new AppError(`No se puede eliminar: ${enUso} horario(s) activo(s) usan esta aula`, 409);
  const updated = await prisma.aula.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data: { activo: false } });
  if (updated.count === 0) throw new AppError('Aula no encontrada', 404);
  res.json({ ok: true });
});

router.post('/:id/asignar-docente', isAdmin, async (req, res) => {
  const { usuarioId, materia, esTutor = false } = z.object({
    usuarioId: z.string(),
    materia:   z.string().optional(),
    esTutor:   z.boolean().optional(),
  }).parse(req.body);

  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, colegioId: req.colegioId! } });
  if (!usuario) throw new AppError('Usuario no encontrado', 404);

  await prisma.docenteAula.upsert({
    where: { usuarioId_aulaId_materia: { usuarioId, aulaId: req.params.id, materia: materia ?? '' } },
    create: { usuarioId, aulaId: req.params.id, materia, esTutor, activo: true },
    update: { esTutor, activo: true },
  });
  res.json({ ok: true });
});

router.delete('/:id/docente/:docenteId', isAdmin, async (req, res) => {
  await prisma.docenteAula.updateMany({
    where: { aulaId: req.params.id, usuarioId: req.params.docenteId },
    data: { activo: false },
  });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECCIONES — CRUD independiente y completo (A, B, C... las que necesite el colegio)
// ═══════════════════════════════════════════════════════════════════════════

const seccionSchema = z.object({
  nivelGradoId: z.string(),
  nombre:       z.string().min(1),
  capacidad:    z.coerce.number().int().positive().optional().nullable(),
});

// ── GET /aulas/secciones — lista todas las secciones del colegio ──────────
router.get('/secciones', async (req, res) => {
  const { nivelGradoId, q } = req.query as Record<string,string>;
  const where: any = { nivelGrado: { colegioId: req.colegioId! } };
  if (nivelGradoId) where.nivelGradoId = nivelGradoId;
  if (q) where.nombre = { contains: q, mode: 'insensitive' };

  const secciones = await prisma.seccion.findMany({
    where,
    include: {
      nivelGrado: { select: { nombre: true, nivel: true, grado: true } },
      _count:     { select: { matriculas: { where: { activa: true } }, aulas: true } },
    },
    orderBy: [{ nivelGrado: { grado: 'asc' } }, { nombre: 'asc' }],
  });
  res.json({ ok: true, data: secciones });
});

router.post('/secciones', isAdmin, async (req, res) => {
  const data = seccionSchema.parse(req.body);
  const nivel = await prisma.nivelGrado.findFirst({ where: { id: data.nivelGradoId, colegioId: req.colegioId! } });
  if (!nivel) throw new AppError('Grado no encontrado', 404);

  const existente = await prisma.seccion.findFirst({ where: { nivelGradoId: data.nivelGradoId, nombre: data.nombre } });
  if (existente) throw new AppError(`Ya existe la sección "${data.nombre}" en ese grado`, 409);

  const seccion = await prisma.seccion.create({ data });
  res.status(201).json({ ok: true, data: seccion });
});

router.patch('/secciones/:id', isAdmin, async (req, res) => {
  const data = seccionSchema.partial().extend({ activo: z.boolean().optional() }).parse(req.body);
  const seccion = await prisma.seccion.findFirst({ where: { id: req.params.id, nivelGrado: { colegioId: req.colegioId! } } });
  if (!seccion) throw new AppError('Sección no encontrada', 404);

  if (data.nombre && data.nombre !== seccion.nombre) {
    const dup = await prisma.seccion.findFirst({
      where: { nivelGradoId: data.nivelGradoId ?? seccion.nivelGradoId, nombre: data.nombre, id: { not: req.params.id } },
    });
    if (dup) throw new AppError(`Ya existe la sección "${data.nombre}" en ese grado`, 409);
  }

  await prisma.seccion.update({ where: { id: req.params.id }, data });
  res.json({ ok: true });
});

router.delete('/secciones/:id', isAdmin, async (req, res) => {
  const seccion = await prisma.seccion.findFirst({ where: { id: req.params.id, nivelGrado: { colegioId: req.colegioId! } } });
  if (!seccion) throw new AppError('Sección no encontrada', 404);

  const enUso = await prisma.matricula.count({ where: { seccionId: req.params.id, activa: true } });
  if (enUso > 0) throw new AppError(`No se puede eliminar: ${enUso} estudiante(s) matriculado(s) en esta sección`, 409);

  await prisma.seccion.update({ where: { id: req.params.id }, data: { activo: false } });
  res.json({ ok: true });
});

export default router;
