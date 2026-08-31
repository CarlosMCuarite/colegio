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
import { uploadFile, getSignedUrlFromStoredValue, storagePathFromStoredUrl, deleteFile } from '../services/storageService';
import { BUCKETS } from '../config/supabase';
import { enviarNotificacion } from '../services/notificacionService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5 } });
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

async function comunicadoConUrlFirmada<T extends { adjuntoUrl: string | null }>(comunicado: T): Promise<T> {
  const legacy = comunicado.adjuntoUrl
    ? await getSignedUrlFromStoredValue(BUCKETS.DOCUMENTOS, comunicado.adjuntoUrl)
    : comunicado.adjuntoUrl;
  const adjuntos = (comunicado as any).adjuntos;
  if (!Array.isArray(adjuntos)) return { ...comunicado, adjuntoUrl: legacy };
  return { ...comunicado, adjuntoUrl: legacy,
    adjuntos: await Promise.all(adjuntos.map(async (a: any) => ({ ...a, url: await getSignedUrlFromStoredValue(BUCKETS.DOCUMENTOS, a.url) }))),
  } as T;
}

async function alcanceComunicadosPadre(usuarioId: string, colegioId: string) {
  const padre = await prisma.padre.findFirst({
    where: { usuarioId, colegioId },
    include: { padreEstudiantes: { include: { estudiante: { include: { matriculas: { where: { activa: true }, include: { nivelGrado: true }, take: 1 } } } } } },
  });
  const matriculas = padre?.padreEstudiantes.flatMap(pe => pe.estudiante.matriculas) ?? [];
  const niveles = [...new Set(matriculas.map(m => m.nivelGrado.nivel))];
  const grados = [...new Set(matriculas.map(m => m.nivelGradoId))];
  const secciones = [...new Set(matriculas.map(m => m.seccionId).filter(Boolean))] as string[];
  return [
    { paraElColegio: true },
    ...(niveles.length ? [{ nivelEducativo: { in: niveles } }] : []),
    ...(grados.length ? [{ gradoId: { in: grados } }] : []),
    ...(secciones.length ? [{ seccionId: { in: secciones } }] : []),
  ];
}

// ── GET /comunicados ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { page = '1', limit = '20', q, nivelEducativo, gradoId, seccionId, estado } = req.query as Record<string,string>;
  const ahora = new Date();
  const where: any = { colegioId: req.colegioId!, activo: true, AND: [] };
  if (q?.trim()) where.AND.push({ OR: [{ titulo: { contains: q.trim(), mode: 'insensitive' } }, { contenido: { contains: q.trim(), mode: 'insensitive' } }] });
  if (nivelEducativo) where.nivelEducativo = nivelEducativo;
  if (gradoId) where.gradoId = gradoId;
  if (seccionId) where.seccionId = seccionId;
  if (estado === 'PROGRAMADO') where.publicadoEn = { gt: ahora };
  else if (estado === 'VENCIDO') where.venceEn = { lte: ahora };
  else if (estado === 'PUBLICADO' || !estado) { where.publicadoEn = { lte: ahora }; where.AND.push({ OR: [{ venceEn: null }, { venceEn: { gt: ahora } }] }); }

  // Padres solo ven comunicados dirigidos a ellos o al colegio
  if (req.user!.rol === RolNombre.PADRE) {
    where.AND.push({ OR: await alcanceComunicadosPadre(req.user!.id, req.colegioId!) });
  }

  const [total, comunicados] = await Promise.all([
    prisma.comunicado.count({ where }),
    prisma.comunicado.findMany({
      where,
      skip: (parseInt(page)-1)*parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { creadoPor: { select: { nombres: true, apellidos: true, rol: true } }, adjuntos: true, _count: { select: { lecturas: true } } },
    }),
  ]);
  const items = await Promise.all(comunicados.map(comunicadoConUrlFirmada));
  res.json({ ok: true, data: items.map((c: any) => ({ ...c, estado: c.publicadoEn && new Date(c.publicadoEn) > ahora ? 'PROGRAMADO' : (c.venceEn && new Date(c.venceEn) <= ahora ? 'VENCIDO' : 'PUBLICADO') })), meta: { total } });
});

// ── GET /comunicados/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const where: any = { id: req.params.id, colegioId: req.colegioId!, activo: true };
  if (req.user!.rol === RolNombre.PADRE) {
    where.OR = await alcanceComunicadosPadre(req.user!.id, req.colegioId!);
  }
  const c = await prisma.comunicado.findFirst({
    where,
    include: { creadoPor: { select: { nombres: true, apellidos: true } }, adjuntos: true, _count: { select: { lecturas: true } } },
  });
  if (!c) throw new AppError('Comunicado no encontrado', 404);
  res.json({ ok: true, data: await comunicadoConUrlFirmada(c) });
});

// Registrar lectura una sola vez por usuario.
router.post('/:id/leer', async (req, res) => {
  const comunicado = await prisma.comunicado.findFirst({ where: { id: req.params.id, colegioId: req.colegioId!, activo: true }, select: { id: true } });
  if (!comunicado) throw new AppError('Comunicado no encontrado', 404);
  await prisma.comunicadoLectura.upsert({
    where: { comunicadoId_usuarioId: { comunicadoId: comunicado.id, usuarioId: req.user!.id } },
    create: { comunicadoId: comunicado.id, usuarioId: req.user!.id },
    update: { leidoEn: new Date() },
  });
  res.json({ ok: true });
});

// ── POST /comunicados ─────────────────────────────────────────────────────────
// Antes solo Staff podía crear comunicados. Ahora un Docente/Tutor también
// puede — pero SOLO para SU PROPIA aula (no puede marcar "para todo el
// colegio" ni elegir un aula que no sea la suya). El backend valida esto,
// no solo el frontend.
router.post(
  '/',
  isDocente,
  upload.array('adjuntos', 5),
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

    const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    const subidos = await Promise.all(archivos.map(file => uploadFile(BUCKETS.DOCUMENTOS, file.buffer, file.originalname, file.mimetype, `${req.colegioId}/comunicados`)));
    if (subidos[0]) { adjuntoUrl = subidos[0].path; adjuntoNombre = subidos[0].nombre; }

    const comunicado = await prisma.comunicado.create({
      data: {
        ...data,
        colegioId:    req.colegioId!,
        creadoPorId:  req.user!.id,
        adjuntoUrl,
        adjuntoNombre,
        publicadoEn:  data.publicadoEn ?? new Date(),
        venceEn:      data.venceEn ?? null,
        notificadoEn: data.publicadoEn && data.publicadoEn <= new Date() ? new Date() : null,
        adjuntos: subidos.length ? { create: subidos.map((r, i) => ({ url: r.path, nombre: r.nombre, mimeType: archivos[i]?.mimetype, tamano: archivos[i]?.size })) } : undefined,
      } as Prisma.ComunicadoUncheckedCreateInput,
    });

    // Notificar a padres afectados (async, no bloquea)
    if (!data.publicadoEn || data.publicadoEn <= new Date()) notificarPadresComunicado(comunicado, req.colegioId!).catch(() => {});

    res.status(201).json({ ok: true, data: comunicado });
  },
);

// ── PATCH /comunicados/:id ────────────────────────────────────────────────────
router.patch(
  '/:id',
  isStaff,
  upload.array('adjuntos', 5),
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
    let adjuntoAnteriorAEliminar: string | null = null;
    let adjuntosNuevos: any[] = [];

    const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (archivos.length) {
      // Se subió un archivo nuevo: reemplaza al anterior.
      const subidos = await Promise.all(archivos.map(file => uploadFile(BUCKETS.DOCUMENTOS, file.buffer, file.originalname, file.mimetype, `${req.colegioId}/comunicados`)));
      const r = subidos[0];
      adjuntosNuevos = subidos;
      adjuntoUrl    = r.path;
      adjuntoNombre = r.nombre;
      if (existente.adjuntoUrl) {
        const anterior = storagePathFromStoredUrl(BUCKETS.DOCUMENTOS, existente.adjuntoUrl);
        if (anterior && anterior !== r.path) adjuntoAnteriorAEliminar = anterior;
      }
    } else if (eliminarAdjunto === 'true' || eliminarAdjunto === true) {
      // El usuario pidió quitar el adjunto sin reemplazarlo.
      if (existente.adjuntoUrl) {
        const anterior = storagePathFromStoredUrl(BUCKETS.DOCUMENTOS, existente.adjuntoUrl);
        if (anterior) adjuntoAnteriorAEliminar = anterior;
      }
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
    if (adjuntosNuevos.length) await prisma.comunicadoAdjunto.createMany({ data: adjuntosNuevos.map((r, i) => ({ comunicadoId: existente.id, url: r.path, nombre: r.nombre, mimeType: archivos[i].mimetype, tamano: archivos[i].size })) });
    if (adjuntoAnteriorAEliminar) await deleteFile(BUCKETS.DOCUMENTOS, adjuntoAnteriorAEliminar);
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
export async function notificarPadresComunicado(comunicado: any, colegioId: string) {
  const destino: any = comunicado.paraElColegio ? {} : {
    padreEstudiantes: { some: { estudiante: { matriculas: { some: {
      activa: true,
      ...(comunicado.gradoId ? { nivelGradoId: comunicado.gradoId } : {}),
      ...(comunicado.seccionId ? { seccionId: comunicado.seccionId } : {}),
      ...(comunicado.nivelEducativo ? { nivelGrado: { nivel: comunicado.nivelEducativo } } : {}),
    } } } } },
  };
  const padres = await prisma.padre.findMany({
    where: { colegioId, deletedAt: null, activo: true, ...destino },
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
