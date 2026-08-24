// src/routes/comunicados.ts
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../config/prisma';
import { authenticate, isStaff, isDocente } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, NivelEducativo, RolNombre, Prisma } from '@prisma/client';
import { uploadFile } from '../services/storageService';
import { BUCKETS } from '../config/supabase';
import { enviarNotificacion } from '../services/notificacionService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(authenticate, resolveTenant, requireTenant);

const comunicadoSchema = z.object({
  titulo:          z.string().min(3),
  contenido:       z.string().min(5),
  paraElColegio:   z.coerce.boolean().default(false),
  nivelEducativo:  z.nativeEnum(NivelEducativo).optional().nullable(),
  gradoId:         z.string().optional().nullable(),
  seccionId:       z.string().optional().nullable(),
  // z.coerce.date() acepta cualquier formato que Date() entienda (incluido el
  // valor crudo de <input type="datetime-local">, sin sufijo "Z"), a
  // diferencia de z.string().datetime() que exige ISO-8601 completo y
  // rechazaba silenciosamente formatos válidos del navegador.
  publicadoEn:     z.coerce.date().optional().nullable(),
  venceEn:         z.coerce.date().optional().nullable(),
});

// ── GET /comunicados ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { page = '1', limit = '20' } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId!, activo: true };

  // Padres solo ven comunicados dirigidos a ellos o al colegio
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({
      where: { usuarioId: req.user!.id, colegioId: req.colegioId! },
      include: { padreEstudiantes: { include: { estudiante: { include: { matriculas: { where: { activa: true }, include: { nivelGrado: true, seccion: true }, take: 1 } } } } } },
    });
    const matricula = padre?.padreEstudiantes[0]?.estudiante?.matriculas[0];
    where.OR = [
      { paraElColegio: true },
      { nivelEducativo: matricula?.nivelGrado?.nivel },
      { gradoId: matricula?.nivelGradoId },
      { seccionId: matricula?.seccionId },
    ];
  }

  const [total, comunicados] = await Promise.all([
    prisma.comunicado.count({ where }),
    prisma.comunicado.findMany({
      where,
      skip: (parseInt(page)-1)*parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { creadoPor: { select: { nombres: true, apellidos: true, rol: true } } },
    }),
  ]);
  res.json({ ok: true, data: comunicados, meta: { total } });
});

// ── GET /comunicados/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const c = await prisma.comunicado.findFirst({
    where: { id: req.params.id, colegioId: req.colegioId! },
    include: { creadoPor: { select: { nombres: true, apellidos: true } } },
  });
  if (!c) throw new AppError('Comunicado no encontrado', 404);
  res.json({ ok: true, data: c });
});

// ── POST /comunicados ─────────────────────────────────────────────────────────
// Antes solo Staff podía crear comunicados. Ahora un Docente/Tutor también
// puede — pero SOLO para SU PROPIA aula (no puede marcar "para todo el
// colegio" ni elegir un aula que no sea la suya). El backend valida esto,
// no solo el frontend.
router.post(
  '/',
  isDocente,
  upload.single('adjunto'),
  auditar({ modulo: 'COMUNICADOS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    // FormData envía TODO como string; un campo opcional vacío llega como ''
    // en vez de omitido, y eso rompe .datetime()/.nativeEnum() aunque sean
    // opcionales. Se normaliza antes de validar.
    const body = { ...req.body };
    for (const campo of ['nivelEducativo', 'gradoId', 'seccionId', 'publicadoEn', 'venceEn']) {
      if (body[campo] === '') body[campo] = undefined;
    }
    const data = comunicadoSchema.parse(body);

    const esStaff = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR, RolNombre.SECRETARIA] as string[]).includes(req.user!.rol);
    if (!esStaff) {
      if (data.paraElColegio) throw new AppError('Solo el Staff puede publicar comunicados para todo el colegio', 403);
      if (!data.seccionId) throw new AppError('Elige el aula/sección para tu comunicado', 400);
      const tieneAcceso = await prisma.docenteAula.findFirst({ where: { usuarioId: req.user!.id, activo: true, aula: { seccionId: data.seccionId } } })
        ?? await prisma.aula.findFirst({ where: { seccionId: data.seccionId, docenteTutorId: req.user!.id } });
      if (!tieneAcceso) throw new AppError('No tienes asignada esa aula/sección', 403);
    }

    let adjuntoUrl: string | undefined;
    let adjuntoNombre: string | undefined;

    if (req.file) {
      const r = await uploadFile(BUCKETS.DOCUMENTOS, req.file.buffer, req.file.originalname, req.file.mimetype, `${req.colegioId}/comunicados`);
      adjuntoUrl    = r.url;
      adjuntoNombre = r.nombre;
    }

    const comunicado = await prisma.comunicado.create({
      data: {
        ...data,
        colegioId:    req.colegioId!,
        creadoPorId:  req.user!.id,
        adjuntoUrl,
        adjuntoNombre,
        publicadoEn:  data.publicadoEn ?? new Date(),
        venceEn:      data.venceEn ?? null,
      } as Prisma.ComunicadoUncheckedCreateInput,
    });

    // Notificar a padres afectados (async, no bloquea)
    notificarPadresComunicado(comunicado, req.colegioId!).catch(() => {});

    res.status(201).json({ ok: true, data: comunicado });
  },
);

// ── PATCH /comunicados/:id ────────────────────────────────────────────────────
router.patch(
  '/:id',
  isStaff,
  upload.single('adjunto'),
  auditar({ modulo: 'COMUNICADOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    // FormData envía TODO como string; normalizar igual que en POST.
    const body = { ...req.body };
    for (const campo of ['nivelEducativo', 'gradoId', 'seccionId', 'publicadoEn', 'venceEn']) {
      if (body[campo] === '') body[campo] = undefined;
    }
    const { eliminarAdjunto, ...resto } = body;
    const data = comunicadoSchema.partial().parse(resto);

    const existente = await prisma.comunicado.findFirst({ where: { id: req.params.id, colegioId: req.colegioId! } });
    if (!existente) throw new AppError('Comunicado no encontrado', 404);

    let adjuntoUrl    = existente.adjuntoUrl;
    let adjuntoNombre = existente.adjuntoNombre;

    if (req.file) {
      // Se subió un archivo nuevo: reemplaza al anterior.
      const r = await uploadFile(BUCKETS.DOCUMENTOS, req.file.buffer, req.file.originalname, req.file.mimetype, `${req.colegioId}/comunicados`);
      adjuntoUrl    = r.url;
      adjuntoNombre = r.nombre;
    } else if (eliminarAdjunto === 'true' || eliminarAdjunto === true) {
      // El usuario pidió quitar el adjunto sin reemplazarlo.
      adjuntoUrl    = null;
      adjuntoNombre = null;
    }

    await prisma.comunicado.updateMany({
      where: { id: req.params.id, colegioId: req.colegioId! },
      data: {
        ...data,
        adjuntoUrl,
        adjuntoNombre,
        // `venceEn` ya es un objeto Date real (el schema usa z.coerce.date()),
        // así que envolverlo de nuevo en "new Date(... as string)" era
        // incorrecto — convertía un Date a string solo para reconvertirlo,
        // y ese cast inválido es lo que rompía la compilación.
        venceEn: data.venceEn ?? undefined,
      },
    });
    res.json({ ok: true });
  },
);

// ── DELETE /comunicados/:id ───────────────────────────────────────────────────
router.delete('/:id', isStaff, async (req, res) => {
  await prisma.comunicado.updateMany({
    where: { id: req.params.id, colegioId: req.colegioId! },
    data: { activo: false },
  });
  res.json({ ok: true });
});

// ── Helper: notificar padres ──────────────────────────────────────────────────
async function notificarPadresComunicado(comunicado: any, colegioId: string) {
  const padres = await prisma.padre.findMany({
    where: { colegioId, deletedAt: null, activo: true },
    include: { usuario: { select: { fcmToken: true } } },
    take: 500,
  });
  for (const padre of padres) {
    await enviarNotificacion({
      colegioId,
      padreId:  padre.id,
      tipo:     'COMUNICADO',
      titulo:   `📢 ${comunicado.titulo}`,
      cuerpo:   comunicado.contenido.slice(0, 120),
      fcmToken: padre.usuario?.fcmToken ?? undefined,
    });
  }
}

export default router;
