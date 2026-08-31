// src/routes/observaciones.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isDocente } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, ObservacionTipo, RolNombre, Prisma } from '@prisma/client';
import { enviarNotificacion } from '../services/notificacionService';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const obsSchema = z.object({
  estudianteId:   z.string(),
  tipo:           z.nativeEnum(ObservacionTipo).default(ObservacionTipo.DISCIPLINARIA),
  descripcion:    z.string().min(5),
  accionTomada:   z.string().optional().nullable(),
  fecha:          z.coerce.date().optional(),
  notificarPadre: z.boolean().default(true),
});

// ── GET /observaciones ────────────────────────────────────────────────────────
router.get('/', isDocente, async (req, res) => {
  const { estudianteId, tipo, page = '1', limit = '50' } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId! };
  if (estudianteId) where.estudianteId = estudianteId;
  if (tipo) where.tipo = tipo as ObservacionTipo;

  const [total, obs] = await Promise.all([
    prisma.observacion.count({ where }),
    prisma.observacion.findMany({
      where,
      skip: (parseInt(page)-1)*parseInt(limit),
      take: parseInt(limit),
      orderBy: { fecha: 'desc' },
      include: {
        estudiante: { select: { nombres: true, apellidos: true, fotoUrl: true } },
        creadoPor:  { select: { nombres: true, apellidos: true, rol: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: obs, meta: { total } });
});

// ── GET /observaciones/estudiante/:id ─────────────────────────────────────────
router.get('/estudiante/:id', async (req, res) => {
  // Padre puede ver observaciones de su hijo
  if (req.user!.rol === RolNombre.PADRE) {
    const esPadre = await prisma.padreEstudiante.findFirst({
      where: { estudianteId: req.params.id, padre: { usuarioId: req.user!.id } },
    });
    if (!esPadre) throw new AppError('Sin acceso', 403);
  }
  const obs = await prisma.observacion.findMany({
    where: { estudianteId: req.params.id, colegioId: req.colegioId! },
    orderBy: { fecha: 'desc' },
    include: { creadoPor: { select: { nombres: true, apellidos: true } } },
  });
  res.json({ ok: true, data: obs });
});

// ── POST /observaciones ───────────────────────────────────────────────────────
router.post(
  '/',
  isDocente,
  auditar({ modulo: 'OBSERVACIONES', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const { notificarPadre, ...data } = obsSchema.parse(req.body);
    const obs = await prisma.observacion.create({
      data: {
        ...data,
        colegioId:      req.colegioId!,
        creadoPorId:    req.user!.id,
        fecha:          data.fecha ?? new Date(),
        notificadoPadre: notificarPadre,
      } as Prisma.ObservacionUncheckedCreateInput,
    });

    // Notificar al padre principal si se solicitó
    if (notificarPadre) {
      const padreRel = await prisma.padreEstudiante.findFirst({
        where: { estudianteId: data.estudianteId, esPrincipal: true },
        include: { padre: { include: { usuario: { select: { fcmToken: true } } } }, estudiante: { select: { nombres: true, apellidos: true } } },
      });
      if (padreRel) {
        await enviarNotificacion({
          colegioId: req.colegioId!,
          padreId:   padreRel.padre.id,
          tipo:      'OBSERVACION',
          titulo:    `⚠️ Observación: ${padreRel.estudiante.nombres}`,
          cuerpo:    (data.descripcion as string).slice(0, 120),
          datos:     { observacionId: obs.id, ruta: '/padre' },
          fcmToken:  padreRel.padre.usuario?.fcmToken ?? undefined,
        });
      }
    }
    res.status(201).json({ ok: true, data: obs });
  },
);

// ── PATCH /observaciones/:id ──────────────────────────────────────────────────
router.patch(
  '/:id',
  isDocente,
  auditar({ modulo: 'OBSERVACIONES', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const data = obsSchema.partial().parse(req.body);
    await prisma.observacion.updateMany({
      where: { id: req.params.id, colegioId: req.colegioId! },
      data: { descripcion: data.descripcion, accionTomada: data.accionTomada, tipo: data.tipo },
    });
    res.json({ ok: true });
  },
);

export default router;
