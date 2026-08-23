// src/routes/cursos.ts
// Cursos/áreas curriculares por grado — reemplaza el texto libre "materia"
// que había en Horario/DocenteAula. Es la base del sistema de notas: una
// nota siempre se registra contra un Curso concreto, nunca contra texto
// libre.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isAdmin, isDocente } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const cursoSchema = z.object({
  nivelGradoId:   z.string(),
  nombre:         z.string().min(2).max(80),
  areaCurricular: z.string().max(80).optional().nullable(),
});

// ── GET /cursos — lista, opcionalmente filtrada por grado ────────────────────
// Abierto a todo el grupo isDocente (Docente necesita ver los cursos de su
// grado para poder elegir cuál dictar/registrar notas).
router.get('/', isDocente, async (req, res) => {
  const { nivelGradoId, incluirInactivos } = req.query as Record<string, string>;
  const where: any = { colegioId: req.colegioId! };
  if (nivelGradoId) where.nivelGradoId = nivelGradoId;
  if (!incluirInactivos) where.activo = true;
  const cursos = await prisma.curso.findMany({
    where,
    include: { nivelGrado: { select: { nombre: true, nivel: true, grado: true } } },
    orderBy: [{ nivelGrado: { grado: 'asc' } }, { nombre: 'asc' }],
  });
  res.json({ ok: true, data: cursos });
});

// ── POST /cursos ──────────────────────────────────────────────────────────────
router.post('/', isAdmin, auditar({ modulo: 'CURSOS', accion: AuditoriaAccion.CREAR }), async (req, res) => {
  const data = cursoSchema.parse(req.body);
  const grado = await prisma.nivelGrado.findFirst({ where: { id: data.nivelGradoId, colegioId: req.colegioId! } });
  if (!grado) throw new AppError('Grado no encontrado', 404);
  const duplicado = await prisma.curso.findFirst({ where: { colegioId: req.colegioId!, nivelGradoId: data.nivelGradoId, nombre: { equals: data.nombre, mode: 'insensitive' } } });
  if (duplicado) throw new AppError('Ya existe un curso con ese nombre en ese grado', 409);
  const curso = await prisma.curso.create({ data: { ...data, colegioId: req.colegioId! } as Prisma.CursoUncheckedCreateInput });
  res.status(201).json({ ok: true, data: curso });
});

// ── POST /cursos/plantilla-por-defecto — crea el set típico de cursos ─────────
// (Comunicación, Matemática, etc.) para TODOS los grados que aún no tengan
// cursos — pensado para arrancar rápido en vez de crear uno por uno.
router.post('/plantilla-por-defecto', isAdmin, auditar({ modulo: 'CURSOS', accion: AuditoriaAccion.CREAR }), async (req, res) => {
  const grados = await prisma.nivelGrado.findMany({ where: { colegioId: req.colegioId!, activo: true } });
  const CURSOS_INICIAL = ['Comunicación', 'Matemática', 'Personal Social', 'Psicomotricidad', 'Arte y Cultura'];
  const CURSOS_PRIMARIA = ['Comunicación', 'Matemática', 'Personal Social', 'Ciencia y Tecnología', 'Arte y Cultura', 'Educación Física', 'Educación Religiosa', 'Inglés'];
  const CURSOS_SECUNDARIA = ['Comunicación', 'Matemática', 'Ciencias Sociales', 'DPCC', 'Ciencia y Tecnología', 'Arte y Cultura', 'Educación Física', 'Educación Religiosa', 'Inglés', 'Educación para el Trabajo'];

  let creados = 0;
  for (const grado of grados) {
    const yaTiene = await prisma.curso.count({ where: { nivelGradoId: grado.id } });
    if (yaTiene > 0) continue;
    const lista = grado.nivel === 'INICIAL' ? CURSOS_INICIAL : grado.nivel === 'PRIMARIA' ? CURSOS_PRIMARIA : CURSOS_SECUNDARIA;
    await prisma.curso.createMany({
      data: lista.map(nombre => ({ colegioId: req.colegioId!, nivelGradoId: grado.id, nombre })),
    });
    creados += lista.length;
  }
  res.status(201).json({ ok: true, cursosCreados: creados });
});

// ── PATCH /cursos/:id ──────────────────────────────────────────────────────────
router.patch('/:id', isAdmin, auditar({ modulo: 'CURSOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }), async (req, res) => {
  const data = cursoSchema.partial().parse(req.body);
  const updated = await prisma.curso.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data });
  if (updated.count === 0) throw new AppError('Curso no encontrado', 404);
  res.json({ ok: true });
});

// ── DELETE /cursos/:id — desactiva (no borra, para no perder notas históricas) ─
router.delete('/:id', isAdmin, auditar({ modulo: 'CURSOS', accion: AuditoriaAccion.ELIMINAR, getRecursoId: r => r.params.id }), async (req, res) => {
  const tieneNotas = await prisma.nota.count({ where: { cursoId: req.params.id } });
  if (tieneNotas > 0) {
    await prisma.curso.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data: { activo: false } });
    return res.json({ ok: true, desactivado: true, motivo: 'Tiene notas registradas — se desactivó en vez de eliminar, para no perder el historial.' });
  }
  await prisma.curso.deleteMany({ where: { id: req.params.id, colegioId: req.colegioId! } });
  res.json({ ok: true, desactivado: false });
});

export default router;
