// src/routes/padres.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isStaff } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, RolNombre, Prisma } from '@prisma/client';
import { supabaseAdmin } from '../config/supabase';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const padreSchema = z.object({
  dni:       z.string().min(7).max(12),
  nombres:   z.string().min(2),
  apellidos: z.string().min(2),
  email:     z.string().email().optional().nullable(),
  telefono:  z.string().optional().nullable(),
  telefono2: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
});

// ── GET /padres ───────────────────────────────────────────────────────────────
router.get('/', isStaff, async (req, res) => {
  const { q, page = '1', limit = '50' } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId!, deletedAt: null };
  if (q) where.OR = [
    { nombres:   { contains: q, mode: 'insensitive' } },
    { apellidos: { contains: q, mode: 'insensitive' } },
    { dni:       { contains: q } },
  ];
  const [total, padres] = await Promise.all([
    prisma.padre.count({ where }),
    prisma.padre.findMany({
      where,
      skip: (parseInt(page)-1)*parseInt(limit),
      take: parseInt(limit),
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      include: {
        padreEstudiantes: {
          include: { estudiante: { select: { nombres: true, apellidos: true, estado: true } } },
        },
        usuario: { select: { activo: true, ultimoLogin: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: padres, meta: { total } });
});

// ── GET /padres/mi-perfil — Para el rol PADRE (dashboard) ────────────────────
router.get('/mi-perfil', async (req, res) => {
  if (req.user!.rol !== RolNombre.PADRE) throw new AppError('Solo para padres', 403);
  const padre = await prisma.padre.findFirst({
    where: { usuarioId: req.user!.id, colegioId: req.colegioId! },
    include: {
      padreEstudiantes: {
        where: { estado: 'APROBADO' },
        include: {
          estudiante: {
            include: {
              matriculas: { where: { activa: true }, include: { nivelGrado: true, seccion: true }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!padre) throw new AppError('Perfil de padre no encontrado', 404);
  res.json({ ok: true, data: padre });
});

// ── POST /padres/solicitar-vinculo — El PADRE solicita vincularse a un hijo ───
// Flujo: Padre ingresa DNI del estudiante → queda PENDIENTE → Admin aprueba
router.post('/solicitar-vinculo', async (req, res) => {
  if (req.user!.rol !== RolNombre.PADRE) throw new AppError('Solo disponible para padres', 403);
  const { estudianteDni, parentesco = 'PADRE' } = z.object({
    estudianteDni: z.string().min(7),
    parentesco:    z.string().optional(),
  }).parse(req.body);

  const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId! } });
  if (!padre) throw new AppError('Perfil de padre no encontrado', 404);

  const estudiante = await prisma.estudiante.findFirst({
    where: { colegioId: req.colegioId!, dni: estudianteDni, deletedAt: null },
  });
  if (!estudiante) throw new AppError('No se encontró ningún estudiante con ese DNI en este colegio', 404);

  const existente = await prisma.padreEstudiante.findUnique({
    where: { padreId_estudianteId: { padreId: padre.id, estudianteId: estudiante.id } },
  });
  if (existente) {
    if (existente.estado === 'APROBADO') throw new AppError('Ya estás vinculado con este estudiante', 409);
    if (existente.estado === 'PENDIENTE') throw new AppError('Ya existe una solicitud pendiente para este estudiante', 409);
  }

  const solicitud = await prisma.padreEstudiante.upsert({
    where: { padreId_estudianteId: { padreId: padre.id, estudianteId: estudiante.id } },
    create: { padreId: padre.id, estudianteId: estudiante.id, parentesco, estado: 'PENDIENTE' },
    update: { estado: 'PENDIENTE', parentesco },
  });

  res.status(201).json({
    ok: true,
    data: solicitud,
    mensaje: `Solicitud enviada. El administrador debe aprobar tu vínculo con ${estudiante.nombres} ${estudiante.apellidos}.`,
  });
});

// ── GET /padres/solicitudes/pendientes — Staff revisa solicitudes ────────────
router.get('/solicitudes/pendientes', isStaff, async (req, res) => {
  const solicitudes = await prisma.padreEstudiante.findMany({
    where: { estado: 'PENDIENTE', estudiante: { colegioId: req.colegioId! } },
    include: {
      padre:      { select: { id: true, nombres: true, apellidos: true, dni: true, telefono: true } },
      estudiante: { select: { id: true, nombres: true, apellidos: true, dni: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, data: solicitudes });
});

// ── PATCH /padres/solicitudes/:id/aprobar ────────────────────────────────────
router.patch(
  '/solicitudes/:id/aprobar',
  isStaff,
  auditar({ modulo: 'PADRES', accion: AuditoriaAccion.APROBAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const vinculo = await prisma.padreEstudiante.findUnique({ where: { id: req.params.id } });
    if (!vinculo) throw new AppError('Solicitud no encontrada', 404);
    await prisma.padreEstudiante.update({
      where: { id: req.params.id },
      data: { estado: 'APROBADO', aprobadoPorId: req.user!.id },
    });
    res.json({ ok: true });
  },
);

// ── PATCH /padres/solicitudes/:id/rechazar ───────────────────────────────────
router.patch(
  '/solicitudes/:id/rechazar',
  isStaff,
  auditar({ modulo: 'PADRES', accion: AuditoriaAccion.RECHAZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const vinculo = await prisma.padreEstudiante.findUnique({ where: { id: req.params.id } });
    if (!vinculo) throw new AppError('Solicitud no encontrada', 404);
    await prisma.padreEstudiante.update({
      where: { id: req.params.id },
      data: { estado: 'RECHAZADO', aprobadoPorId: req.user!.id },
    });
    res.json({ ok: true });
  },
);

// ── GET /padres/:id ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const padre = await prisma.padre.findFirst({
    where: { id: req.params.id, colegioId: req.colegioId!, deletedAt: null },
    include: {
      padreEstudiantes: { include: { estudiante: true } },
      pagos: { orderBy: { createdAt: 'desc' }, take: 10 },
      usuario: { select: { activo: true, ultimoLogin: true, email: true } },
    },
  });
  if (!padre) throw new AppError('Padre no encontrado', 404);
  res.json({ ok: true, data: padre });
});

// ── POST /padres — Secretaría registra padre y opcionalmente crea acceso ──────
router.post(
  '/',
  isStaff,
  auditar({ modulo: 'PADRES', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const schema = padreSchema.extend({
      crearAcceso:     z.boolean().default(false),
      passwordInicial: z.string().min(8).optional(),
      estudiantesDni:  z.array(z.string()).optional(), // vincular al crear
    });
    const { crearAcceso, passwordInicial, estudiantesDni, ...padreData } = schema.parse(req.body);

    const existe = await prisma.padre.findFirst({
      where: { colegioId: req.colegioId!, dni: padreData.dni, deletedAt: null },
    });
    if (existe) throw new AppError('Ya existe un padre con ese DNI', 409);

    let usuarioId: string | undefined;

    // Crear cuenta de acceso si se solicita
    if (crearAcceso && padreData.email && passwordInicial) {
      const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
        email: padreData.email, password: passwordInicial, email_confirm: true,
      });
      if (error) throw new AppError(`Error al crear acceso: ${error.message}`, 400);

      const usuario = await prisma.usuario.create({
        data: {
          supabaseId: authData.user.id,
          colegioId:  req.colegioId!,
          rol:        RolNombre.PADRE,
          nombres:    padreData.nombres,
          apellidos:  padreData.apellidos,
          email:      padreData.email,
        } as Prisma.UsuarioUncheckedCreateInput,
      });
      usuarioId = usuario.id;
    }

    const padre = await prisma.padre.create({
      data: { ...padreData, colegioId: req.colegioId!, usuarioId } as Prisma.PadreUncheckedCreateInput,
    });

    // Vincular estudiantes si se indicaron
    if (estudiantesDni?.length) {
      const estudiantes = await prisma.estudiante.findMany({
        where: { colegioId: req.colegioId!, dni: { in: estudiantesDni }, deletedAt: null },
      });
      await prisma.padreEstudiante.createMany({
        data: estudiantes.map((e, i) => ({
          padreId:      padre.id,
          estudianteId: e.id,
          esPrincipal:  i === 0,
          estado:       'APROBADO', // vínculo creado por staff = ya verificado, no debe quedar pendiente
          aprobadoPorId: req.user!.id,
        })) as Prisma.PadreEstudianteCreateManyInput[],
        skipDuplicates: true,
      });
    }

    res.status(201).json({ ok: true, data: padre });
  },
);

// ── PATCH /padres/:id ─────────────────────────────────────────────────────────
router.patch(
  '/:id',
  auditar({ modulo: 'PADRES', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const data = padreSchema.partial().parse(req.body);
    await prisma.padre.updateMany({
      where: { id: req.params.id, colegioId: req.colegioId!, deletedAt: null },
      data,
    });
    res.json({ ok: true });
  },
);

// ── POST /padres/:id/vincular-estudiante ──────────────────────────────────────
router.post('/:id/vincular-estudiante', isStaff, async (req, res) => {
  const { estudianteDni, parentesco = 'PADRE', esPrincipal = false } = z.object({
    estudianteDni: z.string(),
    parentesco:    z.string().optional(),
    esPrincipal:   z.boolean().optional(),
  }).parse(req.body);

  const estudiante = await prisma.estudiante.findFirst({
    where: { colegioId: req.colegioId!, dni: estudianteDni, deletedAt: null },
  });
  if (!estudiante) throw new AppError('Estudiante no encontrado', 404);

  await prisma.padreEstudiante.upsert({
    where: { padreId_estudianteId: { padreId: req.params.id, estudianteId: estudiante.id } },
    create: { padreId: req.params.id, estudianteId: estudiante.id, parentesco, esPrincipal, estado: 'APROBADO', aprobadoPorId: req.user!.id } as Prisma.PadreEstudianteUncheckedCreateInput,
    update: { parentesco, esPrincipal, estado: 'APROBADO', aprobadoPorId: req.user!.id },
  });
  res.json({ ok: true });
});

// ── GET /padres/:id/dashboard — Dashboard del padre ───────────────────────────
router.get('/:id/dashboard', async (req, res) => {
  // Verificar que el usuario sea este padre o staff
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, id: req.params.id } });
    if (!padre) throw new AppError('Sin acceso', 403);
  }
  const padre = await prisma.padre.findFirst({
    where: { id: req.params.id, colegioId: req.colegioId! },
    include: {
      padreEstudiantes: {
        include: {
          estudiante: {
            include: {
              matriculas:   { where: { activa: true }, include: { nivelGrado: true, seccion: true }, take: 1 },
              asistencias:  { orderBy: { fecha: 'desc' }, take: 30 },
              observaciones:{ orderBy: { createdAt: 'desc' }, take: 5 },
            },
          },
        },
      },
      pagos:       { orderBy: { createdAt: 'desc' }, take: 10 },
      notificaciones: { where: { leida: false }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!padre) throw new AppError('Padre no encontrado', 404);
  res.json({ ok: true, data: padre });
});

export default router;
