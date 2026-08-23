// src/routes/matriculas.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isStaff } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const matriculaSchema = z.object({
  estudianteId:  z.string(),
  nivelGradoId:  z.string(),
  seccionId:     z.string().optional().nullable(),
  anoEscolar:    z.coerce.number().int(),
  observaciones: z.string().optional().nullable(),
});

// ── GET /matriculas ───────────────────────────────────────────────────────────
router.get('/', isStaff, async (req, res) => {
  const { nivelGradoId, seccionId, anoEscolar, activa = 'true', page = '1', limit = '50' } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId! };
  if (nivelGradoId) where.nivelGradoId = nivelGradoId;
  if (seccionId)    where.seccionId    = seccionId;
  if (anoEscolar)   where.anoEscolar   = parseInt(anoEscolar);
  if (activa)       where.activa       = activa === 'true';

  const [total, matriculas] = await Promise.all([
    prisma.matricula.count({ where }),
    prisma.matricula.findMany({
      where,
      skip: (parseInt(page)-1)*parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        estudiante:  { select: { nombres: true, apellidos: true, dni: true, fotoUrl: true, estado: true } },
        nivelGrado:  { select: { nivel: true, grado: true, nombre: true } },
        seccion:     { select: { nombre: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: matriculas, meta: { total } });
});

// ── GET /matriculas/resumen — Conteo por nivel/grado ─────────────────────────
router.get('/resumen', isStaff, async (req, res) => {
  const { anoEscolar } = req.query as Record<string,string>;
  const año = anoEscolar ? parseInt(anoEscolar) : new Date().getFullYear();

  const resumen = await prisma.matricula.groupBy({
    by: ['nivelGradoId', 'seccionId'],
    where: { colegioId: req.colegioId!, anoEscolar: año, activa: true },
    _count: true,
  });

  const nivelGrados = await prisma.nivelGrado.findMany({
    where: { colegioId: req.colegioId! },
    include: { secciones: true },
  });

  res.json({ ok: true, data: { resumen, nivelGrados, año } });
});

// ── GET /matriculas/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const mat = await prisma.matricula.findFirst({
    where: { id: req.params.id, colegioId: req.colegioId! },
    include: {
      estudiante: { include: { padreEstudiantes: { include: { padre: true } } } },
      nivelGrado: true, seccion: true,
    },
  });
  if (!mat) throw new AppError('Matrícula no encontrada', 404);
  res.json({ ok: true, data: mat });
});

// ── POST /matriculas — Matrícula presencial ───────────────────────────────────
router.post(
  '/',
  isStaff,
  auditar({ modulo: 'MATRICULAS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const data = matriculaSchema.parse(req.body);

    // Verificar que el estudiante existe en este colegio
    const estudiante = await prisma.estudiante.findFirst({
      where: { id: data.estudianteId, colegioId: req.colegioId!, deletedAt: null },
    });
    if (!estudiante) throw new AppError('Estudiante no encontrado', 404);

    // Verificar que el nivel/grado existe en este colegio
    const nivelGrado = await prisma.nivelGrado.findFirst({
      where: { id: data.nivelGradoId, colegioId: req.colegioId! },
    });
    if (!nivelGrado) throw new AppError('Nivel/Grado no encontrado', 404);

    // Verificar duplicado
    const existe = await prisma.matricula.findFirst({
      where: { colegioId: req.colegioId!, estudianteId: data.estudianteId, anoEscolar: data.anoEscolar },
    });
    if (existe) throw new AppError(`El estudiante ya tiene matrícula en ${data.anoEscolar}`, 409);

    // Verificar límite del plan
    const colegio = await prisma.colegio.findUnique({
      where: { id: req.colegioId! },
      include: {
        plan: { select: { maxEstudiantes: true } },
        _count: { select: { estudiantes: { where: { estado: 'ACTIVO', deletedAt: null } } } },
      },
    });
    if (colegio!._count.estudiantes >= colegio!.plan.maxEstudiantes)
      throw new AppError(`Límite de estudiantes del plan alcanzado`, 403);

    const matricula = await prisma.matricula.create({
      data: { ...data, colegioId: req.colegioId! } as Prisma.MatriculaUncheckedCreateInput,
      include: { nivelGrado: true, seccion: true },
    });
    res.status(201).json({ ok: true, data: matricula });
  },
);

// ── PATCH /matriculas/:id ─────────────────────────────────────────────────────
router.patch(
  '/:id',
  isStaff,
  auditar({ modulo: 'MATRICULAS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const data = matriculaSchema.partial().parse(req.body);
    await prisma.matricula.updateMany({
      where: { id: req.params.id, colegioId: req.colegioId! },
      data,
    });
    res.json({ ok: true });
  },
);

// ── PATCH /matriculas/:id/desactivar ─────────────────────────────────────────
router.patch('/:id/desactivar', isStaff, async (req, res) => {
  await prisma.matricula.updateMany({
    where: { id: req.params.id, colegioId: req.colegioId! },
    data: { activa: false },
  });
  res.json({ ok: true });
});

export default router;
