// src/routes/documentos.ts
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../config/prisma';
import { authenticate, isStaff } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, DocumentoEstado, DocumentoTipo, RolNombre, Prisma } from '@prisma/client';
import { uploadFile, deleteFile, getSignedUrlFromStoredValue, storagePathFromStoredUrl } from '../services/storageService';
import { BUCKETS } from '../config/supabase';
import { enviarNotificacion } from '../services/notificacionService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
router.use(authenticate, resolveTenant, requireTenant);

const docSchema = z.object({
  estudianteId: z.string().optional().nullable(),
  tipo:         z.nativeEnum(DocumentoTipo),
  nombre:       z.string().min(3),
  descripcion:  z.string().optional().nullable(),
});

async function documentoConUrlFirmada<T extends { archivoUrl: string | null }>(doc: T): Promise<T> {
  if (!doc.archivoUrl) return doc;
  return { ...doc, archivoUrl: await getSignedUrlFromStoredValue(BUCKETS.DOCUMENTOS, doc.archivoUrl) };
}

// ── GET /documentos ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { estudianteId, tipo, estado, q, page = '1', limit = '30' } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId! };
  if (estudianteId) where.estudianteId = estudianteId;
  if (tipo)         where.tipo         = tipo as DocumentoTipo;
  if (estado)       where.estado       = estado as DocumentoEstado;
  if (q) where.OR = [
    { nombre:      { contains: q, mode: 'insensitive' } },
    { descripcion: { contains: q, mode: 'insensitive' } },
  ];

  // Padre solo ve documentos de sus hijos
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({
      where: { usuarioId: req.user!.id, colegioId: req.colegioId! },
      include: { padreEstudiantes: { select: { estudianteId: true } } },
    });
    const ids = padre?.padreEstudiantes.map(pe => pe.estudianteId) ?? [];
    where.estudianteId = { in: ids };
  }

  const [total, docs] = await Promise.all([
    prisma.documento.count({ where }),
    prisma.documento.findMany({
      where,
      skip: (parseInt(page)-1)*parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        estudiante:    { select: { nombres: true, apellidos: true } },
        solicitadoPor: { select: { nombres: true, apellidos: true } },
        procesadoPor:  { select: { nombres: true, apellidos: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: await Promise.all(docs.map(documentoConUrlFirmada)), meta: { total } });
});

// ── GET /documentos/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const where: any = { id: req.params.id, colegioId: req.colegioId! };
  if (req.user!.rol === RolNombre.PADRE) {
    where.estudiante = { padreEstudiantes: { some: { padre: { usuarioId: req.user!.id } } } };
  }
  const doc = await prisma.documento.findFirst({
    where,
    include: {
      estudiante:    true,
      solicitadoPor: { select: { nombres: true, apellidos: true } },
      procesadoPor:  { select: { nombres: true, apellidos: true } },
    },
  });
  if (!doc) throw new AppError('Documento no encontrado', 404);
  res.json({ ok: true, data: await documentoConUrlFirmada(doc) });
});

// ── POST /documentos — Solicitar documento ────────────────────────────────────
router.post(
  '/',
  auditar({ modulo: 'DOCUMENTOS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const data = docSchema.parse(req.body);
    if (req.user!.rol === RolNombre.PADRE && data.estudianteId) {
      const esSuHijo = await prisma.padreEstudiante.findFirst({
        where: { estudianteId: data.estudianteId, padre: { usuarioId: req.user!.id, colegioId: req.colegioId! } },
      });
      if (!esSuHijo) throw new AppError('Sin permisos sobre este estudiante', 403);
    }
    const doc = await prisma.documento.create({
      data: {
        ...data,
        colegioId:      req.colegioId!,
        solicitadoPorId: req.user!.id,
        estado:          DocumentoEstado.PENDIENTE,
      } as Prisma.DocumentoUncheckedCreateInput,
    });
    res.status(201).json({ ok: true, data: doc });
  },
);

// ── PATCH /documentos/:id/estado — Secretaría procesa el documento ────────────
router.patch(
  '/:id/estado',
  isStaff,
  auditar({ modulo: 'DOCUMENTOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const { estado, observaciones, fechaEntrega } = z.object({
      estado:        z.nativeEnum(DocumentoEstado),
      observaciones: z.string().optional(),
      fechaEntrega:  z.coerce.date().optional().nullable(),
    }).parse(req.body);

    const doc = await prisma.documento.findFirst({
      where: { id: req.params.id, colegioId: req.colegioId! },
      include: {
        solicitadoPor: { select: { id: true, fcmToken: true } },
        estudiante:    { select: { nombres: true, apellidos: true } },
      },
    });
    if (!doc) throw new AppError('Documento no encontrado', 404);

    await prisma.documento.update({
      where: { id: req.params.id },
      data: {
        estado,
        observaciones,
        procesadoPorId: req.user!.id,
        fechaEntrega:   fechaEntrega ?? null,
      },
    });

    // Notificar al solicitante
    if (doc.solicitadoPor && estado === DocumentoEstado.LISTO) {
      await enviarNotificacion({
        colegioId: req.colegioId!,
        usuarioId: doc.solicitadoPor.id,
        tipo:      'DOCUMENTO',
        titulo:    `📄 Documento listo: ${doc.nombre}`,
        cuerpo:    `Tu documento ${doc.nombre} ya está listo para recoger.`,
        fcmToken:  (doc.solicitadoPor as any).fcmToken ?? undefined,
      });
    }
    res.json({ ok: true });
  },
);

// ── POST /documentos/:id/archivo — Adjuntar archivo al documento ──────────────
router.post(
  '/:id/archivo',
  isStaff,
  upload.single('archivo'),
  async (req, res) => {
    if (!req.file) throw new AppError('Archivo requerido', 400);
    const doc = await prisma.documento.findFirst({
      where: { id: req.params.id, colegioId: req.colegioId! },
    });
    if (!doc) throw new AppError('Documento no encontrado', 404);

    const result = await uploadFile(
      BUCKETS.DOCUMENTOS,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      `${req.colegioId}/documentos`,
    );

    await prisma.documento.update({
      where: { id: req.params.id },
      data: {
        archivoUrl:      result.path,
        archivoNombre:   result.nombre,
        archivoTamanoKB: result.tamañoKB,
        estado:          DocumentoEstado.LISTO,
        procesadoPorId:  req.user!.id,
      },
    });
    if (doc.archivoUrl) {
      const anterior = storagePathFromStoredUrl(BUCKETS.DOCUMENTOS, doc.archivoUrl);
      if (anterior && anterior !== result.path) await deleteFile(BUCKETS.DOCUMENTOS, anterior);
    }
    res.json({ ok: true, archivoUrl: await getSignedUrlFromStoredValue(BUCKETS.DOCUMENTOS, result.path) });
  },
);

// ── PATCH /documentos/:id — Editar metadata (nombre, tipo, descripción) ───────
router.patch(
  '/:id',
  isStaff,
  auditar({ modulo: 'DOCUMENTOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const data = docSchema.partial().parse(req.body);
    const updated = await prisma.documento.updateMany({
      where: { id: req.params.id, colegioId: req.colegioId! },
      data,
    });
    if (updated.count === 0) throw new AppError('Documento no encontrado', 404);
    res.json({ ok: true });
  },
);

// ── DELETE /documentos/:id — Elimina el registro y su archivo en Storage ─────
router.delete(
  '/:id',
  isStaff,
  auditar({ modulo: 'DOCUMENTOS', accion: AuditoriaAccion.ELIMINAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const doc = await prisma.documento.findFirst({ where: { id: req.params.id, colegioId: req.colegioId! } });
    if (!doc) throw new AppError('Documento no encontrado', 404);

    if (doc.archivoUrl) {
      try {
        const path = storagePathFromStoredUrl(BUCKETS.DOCUMENTOS, doc.archivoUrl);
        if (path) await deleteFile(BUCKETS.DOCUMENTOS, path);
      } catch {
        // No bloquear el borrado del registro si el archivo ya no existe en Storage
      }
    }

    await prisma.documento.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  },
);

export default router;
