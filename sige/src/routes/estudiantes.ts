// src/routes/estudiantes.ts
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../config/prisma';
import { authenticate, isStaff, isDocente } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, EstudianteEstado, RolNombre, Prisma } from '@prisma/client';
import { uploadFile, BUCKETS } from '../services/storageService';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

const router = Router();
router.use(authenticate, resolveTenant);

const estudianteSchema = z.object({
  dni:             z.string().min(7).max(12),
  nombres:         z.string().min(2),
  apellidos:       z.string().min(2),
  fechaNacimiento: z.string().optional().nullable(), // acepta yyyy-mm-dd o datetime
  genero:          z.enum(['M','F','OTRO']).optional().nullable(),
  direccion:       z.string().optional().nullable(),
  estado:          z.nativeEnum(EstudianteEstado).optional(),
  anoIngreso:      z.coerce.number().int().optional().nullable(),
});

const saludSchema = z.object({
  tipoSangre:    z.string().optional().nullable(),
  alergias:      z.string().optional().nullable(),
  medicacion:    z.string().optional().nullable(),
  restricciones: z.string().optional().nullable(),
  notasSalud:    z.string().optional().nullable(),
});

// ── GET /estudiantes ──────────────────────────────────────────────────────────
// Hueco de seguridad real encontrado: esta ruta no tenía NINGÚN control de
// rol — cualquier Padre (u otro rol) podía listar TODOS los estudiantes del
// colegio, incluyendo el teléfono de padres de otras familias. Se restringe
// a Staff + roles tipo Docente (isDocente) — Padre sigue viendo a sus
// propios hijos por /dashboard/padre, que ya estaba correctamente filtrado.
router.get('/', isDocente, async (req, res) => {
  const { q, estado, nivelGradoId, seccionId, page = '1', limit = '50' } = req.query as Record<string,string>;
  const colegioId = req.colegioId ?? req.user!.colegioId;
  if (!colegioId && req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin colegio', 400);

  const where: any = { deletedAt: null };
  if (colegioId) where.colegioId = colegioId;
  if (estado) where.estado = estado as EstudianteEstado;
  if (q) where.OR = [
    { nombres:   { contains: q, mode: 'insensitive' } },
    { apellidos: { contains: q, mode: 'insensitive' } },
    { dni:       { contains: q } },
  ];
  if (nivelGradoId || seccionId) {
    where.matriculas = { some: { activa: true, ...(nivelGradoId && { nivelGradoId }), ...(seccionId && { seccionId }) } };
  }

  const skip = (parseInt(page)-1) * parseInt(limit);
  const [total, estudiantes] = await Promise.all([
    prisma.estudiante.count({ where }),
    prisma.estudiante.findMany({
      where, skip, take: parseInt(limit),
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      include: {
        matriculas: {
          where: { activa: true },
          include: { nivelGrado: true, seccion: true },
          take: 1,
        },
        padreEstudiantes: {
          include: { padre: { select: { nombres: true, apellidos: true, telefono: true } } },
          take: 1,
        },
      },
    }),
  ]);
  res.json({ ok: true, data: estudiantes, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
});

// ── GET /estudiantes/:id ──────────────────────────────────────────────────────
// Mismo criterio que la lista: solo Staff/Docente-family. Padre nunca llama
// esta ruta directamente (usa /dashboard/padre, ya scoped a sus hijos).
router.get('/:id', isDocente, async (req, res) => {
  const colegioId = req.colegioId ?? req.user!.colegioId;
  const where: any = { id: req.params.id, deletedAt: null };
  if (colegioId) where.colegioId = colegioId;

  const estudiante = await prisma.estudiante.findFirst({
    where,
    include: {
      matriculas:   { include: { nivelGrado: true, seccion: true } },
      padreEstudiantes: { include: { padre: true } },
      asistencias:  { orderBy: { fecha: 'desc' }, take: 30 },
      observaciones:{ orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!estudiante) throw new AppError('Estudiante no encontrado', 404);
  res.json({ ok: true, data: estudiante });
});

// ── POST /estudiantes ─────────────────────────────────────────────────────────
router.post(
  '/',
  isStaff,
  auditar({ modulo: 'ESTUDIANTES', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const colegioId = req.colegioId ?? req.user!.colegioId;
    if (!colegioId) throw new AppError('Sin colegio especificado', 400);

    const data = estudianteSchema.parse(req.body);

    const existe = await prisma.estudiante.findFirst({
      where: { colegioId, dni: data.dni, deletedAt: null },
    });
    if (existe) throw new AppError('Ya existe un estudiante con ese DNI', 409);

    // Parsear fecha — acepta yyyy-mm-dd o ISO datetime
    let fechaNacimiento: Date | null = null;
    if (data.fechaNacimiento) {
      fechaNacimiento = new Date(data.fechaNacimiento as string);
      if (isNaN(fechaNacimiento.getTime())) fechaNacimiento = null;
    }

    const estudiante = await prisma.estudiante.create({
      data: {
        ...data,
        colegioId,
        codigoQR:       data.dni,
        fechaNacimiento,
      } as Prisma.EstudianteUncheckedCreateInput,
    });
    res.status(201).json({ ok: true, data: estudiante });
  },
);

// ── PATCH /estudiantes/:id ────────────────────────────────────────────────────
router.patch(
  '/:id',
  isStaff,
  auditar({ modulo: 'ESTUDIANTES', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const colegioId = req.colegioId ?? req.user!.colegioId;
    const data = estudianteSchema.partial().parse(req.body);

    let fechaNacimiento: Date | null | undefined;
    if (data.fechaNacimiento !== undefined) {
      fechaNacimiento = data.fechaNacimiento ? new Date(data.fechaNacimiento as string) : null;
      if (fechaNacimiento && isNaN(fechaNacimiento.getTime())) fechaNacimiento = null;
    }

    const where: any = { id: req.params.id, deletedAt: null };
    if (colegioId) where.colegioId = colegioId;

    const updated = await prisma.estudiante.updateMany({
      where,
      data: { ...data, fechaNacimiento },
    });
    if (updated.count === 0) throw new AppError('Estudiante no encontrado', 404);
    res.json({ ok: true });
  },
);

// ── PATCH /estudiantes/:id/salud ──────────────────────────────────────────────
router.patch('/:id/salud', async (req, res) => {
  const data = saludSchema.parse(req.body);
  if (req.user!.rol === RolNombre.PADRE) {
    const esPadre = await prisma.padreEstudiante.findFirst({
      where: { estudianteId: req.params.id, padre: { usuarioId: req.user!.id } },
    });
    if (!esPadre) throw new AppError('Sin permisos sobre este estudiante', 403);
  } else {
    const rolesSalud: RolNombre[] = [
      RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR,
      RolNombre.SECRETARIA, RolNombre.PSICOLOGO, RolNombre.ENFERMERIA,
    ];
    if (!rolesSalud.includes(req.user!.rol)) throw new AppError('Sin permisos para editar información de salud', 403);
  }
  const colegioId = req.colegioId ?? req.user!.colegioId;
  const where: any = { id: req.params.id, deletedAt: null };
  if (colegioId) where.colegioId = colegioId;
  await prisma.estudiante.updateMany({ where, data });
  res.json({ ok: true });
});

// ── DELETE /estudiantes/:id — Soft delete ─────────────────────────────────────
router.delete(
  '/:id',
  isStaff,
  auditar({ modulo: 'ESTUDIANTES', accion: AuditoriaAccion.ELIMINAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const colegioId = req.colegioId ?? req.user!.colegioId;
    const where: any = { id: req.params.id, deletedAt: null };
    if (colegioId) where.colegioId = colegioId;
    await prisma.estudiante.updateMany({
      where,
      data: { deletedAt: new Date(), estado: EstudianteEstado.INACTIVO },
    });
    res.json({ ok: true });
  },
);

// ── POST /estudiantes/:id/restaurar ──────────────────────────────────────────
router.post('/:id/restaurar', isStaff, async (req, res) => {
  const colegioId = req.colegioId ?? req.user!.colegioId;
  const where: any = { id: req.params.id };
  if (colegioId) where.colegioId = colegioId;
  await prisma.estudiante.updateMany({
    where,
    data: { deletedAt: null, estado: EstudianteEstado.ACTIVO },
  });
  res.json({ ok: true });
});

// ── GET /asistencia/resumen/:estudianteId ─────────────────────────────────────
router.get('/:id/asistencia-resumen', async (req, res) => {
  const { mes, ano = new Date().getFullYear().toString() } = req.query as Record<string,string>;
  const colegioId = req.colegioId ?? req.user!.colegioId;
  const where: any = { estudianteId: req.params.id };
  if (colegioId) where.colegioId = colegioId;
  if (mes) {
    const inicio = new Date(`${ano}-${mes.padStart(2,'0')}-01`);
    const fin    = new Date(parseInt(ano), parseInt(mes), 0, 23, 59, 59);
    where.fecha  = { gte: inicio, lte: fin };
  }
  const asistencias = await prisma.asistencia.findMany({ where, orderBy: { fecha: 'asc' } });
  res.json({ ok: true, data: {
    total:        asistencias.length,
    presentes:    asistencias.filter(a => a.estado === 'PRESENTE').length,
    ausentes:     asistencias.filter(a => a.estado === 'AUSENTE').length,
    tardanzas:    asistencias.filter(a => a.estado === 'TARDANZA').length,
    justificados: asistencias.filter(a => a.estado === 'JUSTIFICADO').length,
    detalle:      asistencias,
  }});
});

// ── POST /estudiantes/:id/foto ────────────────────────────────────────────────
// Antes solo el personal (isStaff) podía subir la foto. Ahora un PADRE
// también puede subir la foto de SU propio hijo (para el carnet) — se
// verifica que el estudiante realmente sea hijo suyo antes de aceptar.
router.post('/:id/foto', upload.single('foto'), async (req, res) => {
  if (!req.file) throw new AppError('Archivo requerido', 400);
  const colegioId = req.colegioId ?? req.user!.colegioId;
  const where: any = { id: req.params.id, deletedAt: null };
  if (colegioId) where.colegioId = colegioId;

  const ROLES_STAFF_FOTO: RolNombre[] = [RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR, RolNombre.SECRETARIA];
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId } });
    if (!padre) throw new AppError('Perfil de padre no encontrado', 404);
    where.padreEstudiantes = { some: { padreId: padre.id } };
  } else if (!ROLES_STAFF_FOTO.includes(req.user!.rol)) {
    throw new AppError('Sin acceso', 403);
  }

  const estudiante = await prisma.estudiante.findFirst({ where });
  if (!estudiante) throw new AppError('Estudiante no encontrado', 404);

  const result = await uploadFile(BUCKETS.AVATARES, req.file.buffer, req.file.originalname, req.file.mimetype, `estudiantes/${estudiante.id}`);
  await prisma.estudiante.update({ where: { id: estudiante.id }, data: { fotoUrl: result.url } });
  res.json({ ok: true, fotoUrl: result.url });
});

export default router;
