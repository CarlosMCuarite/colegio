// src/routes/encuestas.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isStaff } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, EncuestaEstado, RolNombre } from '@prisma/client';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const preguntaSchema = z.object({
  orden:     z.number().int(),
  pregunta:  z.string().min(3),
  tipo:      z.enum(['TEXTO','OPCION_UNICA','OPCION_MULTIPLE','ESCALA']),
  opciones:  z.array(z.string()).default([]),
  requerida: z.boolean().default(true),
});

const encuestaSchema = z.object({
  titulo:      z.string().min(3),
  descripcion: z.string().optional().nullable(),
  anonima:     z.coerce.boolean().default(false),
  // z.coerce.date() en vez de z.string().datetime(): acepta cualquier formato
  // que Date() entienda, no solo ISO-8601 con sufijo "Z" (misma causa raíz
  // del 422 en Comunicados — ver CHANGELOG_V8.5.md).
  fechaInicio: z.coerce.date().optional().nullable(),
  fechaFin:    z.coerce.date().optional().nullable(),
  preguntas:   z.array(preguntaSchema).min(1),
});

// ── GET /encuestas ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { estado, page = '1', limit = '20' } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId! };
  // Padres solo ven encuestas activas
  if (req.user!.rol === RolNombre.PADRE) where.estado = EncuestaEstado.ACTIVA;
  else if (estado) where.estado = estado as EncuestaEstado;

  const [total, encuestas] = await Promise.all([
    prisma.encuesta.count({ where }),
    prisma.encuesta.findMany({
      where,
      skip: (parseInt(page)-1)*parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        creadaPor: { select: { nombres: true, apellidos: true } },
        _count: { select: { preguntas: true, respuestas: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: encuestas, meta: { total } });
});

// ── GET /encuestas/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const enc = await prisma.encuesta.findFirst({
    where: { id: req.params.id, colegioId: req.colegioId! },
    include: {
      preguntas: { orderBy: { orden: 'asc' } },
      _count: { select: { respuestas: true } },
    },
  });
  if (!enc) throw new AppError('Encuesta no encontrada', 404);
  res.json({ ok: true, data: enc });
});

// ── GET /encuestas/:id/resultados — Solo staff ────────────────────────────────
router.get('/:id/resultados', isStaff, async (req, res) => {
  const enc = await prisma.encuesta.findFirst({
    where: { id: req.params.id, colegioId: req.colegioId! },
    include: {
      preguntas: {
        orderBy: { orden: 'asc' },
        include: { respuestasDetalle: true },
      },
      _count: { select: { respuestas: { where: { completada: true } } } },
    },
  });
  if (!enc) throw new AppError('Encuesta no encontrada', 404);

  // Agregar conteo de opciones por pregunta
  const resultados = enc.preguntas.map(p => {
    const conteo: Record<string, number> = {};
    p.respuestasDetalle.forEach(r => {
      conteo[r.valor] = (conteo[r.valor] || 0) + 1;
    });
    return { ...p, conteo, totalRespuestas: p.respuestasDetalle.length };
  });

  res.json({ ok: true, data: { ...enc, resultados, totalCompletadas: enc._count.respuestas } });
});

// ── POST /encuestas ───────────────────────────────────────────────────────────
router.post(
  '/',
  isStaff,
  auditar({ modulo: 'ENCUESTAS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const { preguntas, ...encData } = encuestaSchema.parse(req.body);
    const enc = await prisma.encuesta.create({
      data: {
        ...encData,
        colegioId:   req.colegioId!,
        creadaPorId: req.user!.id,
        fechaInicio: encData.fechaInicio ?? null,
        fechaFin:    encData.fechaFin    ?? null,
        preguntas: { create: preguntas },
      },
      include: { preguntas: true },
    });
    res.status(201).json({ ok: true, data: enc });
  },
);

// ── PATCH /encuestas/:id/estado ───────────────────────────────────────────────
router.patch('/:id/estado', isStaff, async (req, res) => {
  const { estado } = z.object({ estado: z.nativeEnum(EncuestaEstado) }).parse(req.body);
  await prisma.encuesta.updateMany({
    where: { id: req.params.id, colegioId: req.colegioId! },
    data: { estado },
  });
  res.json({ ok: true });
});

// ── POST /encuestas/:id/responder — Padre responde ───────────────────────────
router.post('/:id/responder', async (req, res) => {
  if (req.user!.rol !== RolNombre.PADRE) throw new AppError('Solo para padres', 403);

  const enc = await prisma.encuesta.findFirst({
    where: { id: req.params.id, colegioId: req.colegioId!, estado: EncuestaEstado.ACTIVA },
    include: { preguntas: true },
  });
  if (!enc) throw new AppError('Encuesta no disponible', 404);

  const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId! } });
  if (!padre) throw new AppError('Perfil de padre no encontrado', 404);

  // Verificar si ya respondió
  const yaRespondio = await prisma.encuestaRespuesta.findFirst({
    where: { encuestaId: enc.id, padreId: padre.id, completada: true },
  });
  if (yaRespondio) throw new AppError('Ya respondiste esta encuesta', 409);

  const schema = z.object({
    respuestas: z.array(z.object({ preguntaId: z.string(), valor: z.string() })),
  });
  const { respuestas } = schema.parse(req.body);

  const respuesta = await prisma.encuestaRespuesta.create({
    data: {
      encuestaId: enc.id,
      padreId:    enc.anonima ? null : padre.id,
      completada: true,
      detalles: {
        create: respuestas.map(r => ({
          preguntaId: r.preguntaId,
          valor:      r.valor,
        })),
      },
    },
  });
  res.status(201).json({ ok: true, data: respuesta });
});

export default router;
