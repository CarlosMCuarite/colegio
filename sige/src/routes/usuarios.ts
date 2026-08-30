// src/routes/usuarios.ts
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../config/prisma';
import { authenticate, isAdmin, isStaff } from '../middleware/auth';
import { ROLES_OPCIONALES } from '../utils/roles';
import { resolveTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, RolNombre } from '@prisma/client';
import { supabaseAdmin } from '../config/supabase';
import { uploadFile, deleteFile, storagePathFromStoredUrl } from '../services/storageService';
import { BUCKETS } from '../config/supabase';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });
router.use(authenticate, resolveTenant);

// ── GET /usuarios ─────────────────────────────────────────────────────────────
// Antes esta ruta no tenía ningún guard de rol (solo requería estar logueado),
// así que un Padre o Docente también podía listar TODO el staff del colegio
// (nombres, emails, DNI, teléfonos). Se restringe a Admin/Director/Secretaría
// y SuperAdmin (que ve todos los colegios).
router.get('/', isStaff, async (req, res) => {
  const user = req.user!;
  const { q, rol, activo, page = '1', limit = '50' } = req.query as Record<string,string>;

  const colegioId = req.colegioId ?? user.colegioId;
  const where: any = { deletedAt: null };
  if (colegioId) where.colegioId = colegioId;
  if (rol)    where.rol    = rol as RolNombre;
  if (activo !== undefined) where.activo = activo === 'true';
  if (q) where.OR = [
    { nombres:   { contains: q, mode: 'insensitive' } },
    { apellidos: { contains: q, mode: 'insensitive' } },
    { email:     { contains: q, mode: 'insensitive' } },
  ];

  const [total, usuarios] = await Promise.all([
    prisma.usuario.count({ where }),
    prisma.usuario.findMany({
      where,
      skip: (parseInt(page)-1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { apellidos: 'asc' },
      select: {
        id: true, nombres: true, apellidos: true, email: true,
        rol: true, dni: true, telefono: true, avatarUrl: true,
        activo: true, ultimoLogin: true, createdAt: true,
        colegio: { select: { id: true, nombre: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: usuarios, meta: { total } });
});

// ── GET /usuarios/:id ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const user = req.user!;
  const isSelf    = user.id === req.params.id;
  const isManager = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR] as string[]).includes(user.rol);
  if (!isSelf && !isManager) throw new AppError('Sin permisos', 403);

  const colegioId = req.colegioId ?? user.colegioId;
  const where: any = { id: req.params.id };
  if (colegioId && user.rol !== RolNombre.SUPERADMIN) where.colegioId = colegioId;

  const usuario = await prisma.usuario.findFirst({
    where,
    select: {
      id: true, nombres: true, apellidos: true, email: true, rol: true,
      dni: true, telefono: true, avatarUrl: true, activo: true,
      ultimoLogin: true, createdAt: true, colegioId: true,
    },
  });
  if (!usuario) throw new AppError('Usuario no encontrado', 404);
  res.json({ ok: true, data: usuario });
});

// ── POST /usuarios ────────────────────────────────────────────────────────────
// Solo ADMINISTRADOR y PADRE están siempre permitidos sin importar el plan.
// Todos los demás son configurables por el SuperAdmin en Roles por Plan —
// ver v8.4 punto 15. Lista centralizada en utils/roles.ts (también la usa
// el middleware authenticate para pausar cuentas si el plan cambia).

router.post(
  '/',
  isAdmin,
  auditar({ modulo: 'USUARIOS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const schema = z.object({
      nombres:   z.string().min(2),
      apellidos: z.string().min(2),
      email:     z.string().email(),
      password:  z.string().min(8),
      rol:       z.nativeEnum(RolNombre),
      dni:       z.string().optional().nullable(),
      telefono:  z.string().optional().nullable(),
    });
    const data = schema.parse(req.body) as {
      nombres: string; apellidos: string; email: string; password: string;
      rol: RolNombre; dni?: string | null; telefono?: string | null;
    };
    const colegioId = req.colegioId ?? req.user!.colegioId;
    if (!colegioId && req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin colegio', 400);

    // Verificar límite del plan Y roles habilitados — SIEMPRE en vivo, nunca cacheado.
    // Esto es lo que impide que un colegio degradado a un plan inferior siga
    // pudiendo crear roles (ej. Psicólogo) que ese plan ya no incluye.
    if (colegioId) {
      const colegio = await prisma.colegio.findUnique({
        where: { id: colegioId },
        include: {
          plan: { select: { maxUsuarios: true, rolesHabilitados: true } },
          _count: { select: { usuarios: { where: { activo: true } } } },
        },
      });
      if (!colegio) throw new AppError('Colegio no encontrado', 404);
      if (colegio._count.usuarios >= colegio.plan.maxUsuarios) {
        throw new AppError(`Límite de usuarios del plan alcanzado (${colegio.plan.maxUsuarios})`, 403);
      }
      if (ROLES_OPCIONALES.includes(data.rol)) {
        const permitidoPorPlan = colegio.plan.rolesHabilitados.includes(data.rol);
        if (!permitidoPorPlan) {
          throw new AppError(`Rol no permitido por el plan contratado.`, 403);
        }
      }
    }

    // Crear en Supabase Auth
    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
      email:         data.email,
      password:      data.password,
      email_confirm: true,
    });
    if (error) throw new AppError(`Error al crear cuenta: ${error.message}`, 400);

    const usuario = await prisma.usuario.create({
      data: {
        supabaseId: authData.user.id,
        colegioId:  colegioId ?? null,
        rol:        data.rol,
        nombres:    data.nombres,
        apellidos:  data.apellidos,
        email:      data.email,
        dni:        data.dni,
        telefono:   data.telefono,
      },
    });
    res.status(201).json({ ok: true, data: { id: usuario.id, email: usuario.email, rol: usuario.rol } });
  },
);

// ── PATCH /usuarios/:id ───────────────────────────────────────────────────────
router.patch(
  '/:id',
  auditar({ modulo: 'USUARIOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const user   = req.user!;
    const isSelf    = user.id === req.params.id;
    const isManager = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR] as string[]).includes(user.rol);
    if (!isSelf && !isManager) throw new AppError('Sin permisos', 403);

    const schema = z.object({
      nombres:   z.string().min(2).optional(),
      apellidos: z.string().min(2).optional(),
      telefono:  z.string().optional().nullable(),
      dni:       z.string().optional().nullable(),
      direccion: z.string().optional().nullable(),
      activo:    z.boolean().optional(),
    });
    const data = schema.parse(req.body);

    // Solo managers pueden cambiar activo
    if (data.activo !== undefined && !isManager) throw new AppError('Sin permisos', 403);

    // Buscar el usuario para actualizar
    const colegioId = req.colegioId ?? user.colegioId;
    const where: any = { id: req.params.id };
    if (colegioId && user.rol !== RolNombre.SUPERADMIN) where.colegioId = colegioId;

    const existente = await prisma.usuario.findFirst({ where });
    if (!existente) throw new AppError('Usuario no encontrado', 404);

    await prisma.usuario.update({
      where: { id: req.params.id },
      data,
    });

    // Si el usuario es un padre de familia, su nombre/teléfono también vive
    // por separado en el registro Padre (usado en matrículas, permisos,
    // pagos, etc.) — hay que mantenerlo sincronizado o "Mi Perfil" no se
    // reflejaría en el resto del sistema.
    if (existente.rol === RolNombre.PADRE && (data.nombres || data.apellidos || data.telefono !== undefined || data.dni !== undefined || data.direccion !== undefined)) {
      await prisma.padre.updateMany({
        where: { usuarioId: req.params.id },
        data: {
          ...(data.nombres   ? { nombres: data.nombres }     : {}),
          ...(data.apellidos ? { apellidos: data.apellidos } : {}),
          ...(data.telefono  !== undefined ? { telefono: data.telefono }   : {}),
          ...(data.dni       ? { dni: data.dni } : {}),
          ...(data.direccion !== undefined ? { direccion: data.direccion } : {}),
        },
      });
    }

    res.json({ ok: true });
  },
);

// ── POST /usuarios/:id/avatar ─────────────────────────────────────────────────
router.post('/:id/avatar', upload.single('avatar'), async (req, res) => {
  const user = req.user!;
  if (user.id !== req.params.id && !([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR] as string[]).includes(user.rol))
    throw new AppError('Sin permisos', 403);
  if (!req.file) throw new AppError('Archivo requerido', 400);
  const anterior = await prisma.usuario.findUnique({ where: { id: req.params.id }, select: { avatarUrl: true } });
  if (!anterior) throw new AppError('Usuario no encontrado', 404);
  const colegioId = req.colegioId ?? user.colegioId ?? 'global';
  const result = await uploadFile(BUCKETS.AVATARES, req.file.buffer, req.file.originalname, req.file.mimetype, colegioId);
  try {
    await prisma.usuario.update({ where: { id: req.params.id }, data: { avatarUrl: result.url } });
  } catch (error) {
    await deleteFile(BUCKETS.AVATARES, result.path);
    throw error;
  }
  const pathAnterior = anterior.avatarUrl ? storagePathFromStoredUrl(BUCKETS.AVATARES, anterior.avatarUrl) : null;
  if (pathAnterior && pathAnterior !== result.path) await deleteFile(BUCKETS.AVATARES, pathAnterior);
  res.json({ ok: true, avatarUrl: result.url });
});

// ── POST /usuarios/:id/restablecer-password ───────────────────────────────────
// No existe forma de "ver" la contraseña actual de alguien (ni este sistema
// ni ninguno guarda contraseñas en texto plano — Supabase Auth solo guarda
// el hash). Lo que SÍ se puede hacer, y es la forma correcta de resolver
// "se me olvidó mi contraseña", es que el SuperAdmin (cualquier colegio) o el
// Administrador (solo su propio colegio) le asignen una contraseña NUEVA al
// usuario. Esa contraseña nueva se devuelve una sola vez en la respuesta para
// mostrarla en pantalla (con el ojito) — después de cerrar ese modal ya no
// queda visible en ningún lado, ni siquiera para el SuperAdmin.
router.post(
  '/:id/restablecer-password',
  isAdmin,
  auditar({ modulo: 'USUARIOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const user = req.user!;
    const schema = z.object({ password: z.string().min(8).optional() });
    const { password: passwordManual } = schema.parse(req.body ?? {});

    const colegioId = req.colegioId ?? user.colegioId;
    const where: any = { id: req.params.id };
    if (colegioId && user.rol !== RolNombre.SUPERADMIN) where.colegioId = colegioId;

    const usuario = await prisma.usuario.findFirst({ where });
    if (!usuario) throw new AppError('Usuario no encontrado', 404);

    const nuevaPassword = passwordManual ?? generarPasswordTemporal();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(usuario.supabaseId, { password: nuevaPassword });
    if (error) throw new AppError(`No se pudo restablecer la contraseña: ${error.message}`, 400);

    res.json({ ok: true, data: { password: nuevaPassword } });
  },
);

function generarPasswordTemporal(): string {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  let pass = '';
  for (let i = 0; i < 6; i++) pass += letras[Math.floor(Math.random() * letras.length)];
  for (let i = 0; i < 3; i++) pass += numeros[Math.floor(Math.random() * numeros.length)];
  return pass + '!';
}

// ── DELETE /usuarios/:id ──────────────────────────────────────────────────────
router.delete(
  '/:id',
  isAdmin,
  auditar({ modulo: 'USUARIOS', accion: AuditoriaAccion.ELIMINAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const user = req.user!;
    if (user.id === req.params.id) throw new AppError('No puedes eliminarte a ti mismo', 400);

    const colegioId = req.colegioId ?? user.colegioId;
    const where: any = { id: req.params.id };
    if (colegioId && user.rol !== RolNombre.SUPERADMIN) where.colegioId = colegioId;

    const usuario = await prisma.usuario.findFirst({ where });
    if (!usuario) throw new AppError('Usuario no encontrado', 404);

    await Promise.all([
      supabaseAdmin.auth.admin.deleteUser(usuario.supabaseId).catch(() => {}),
      prisma.usuario.update({
        where: { id: req.params.id },
        data: { activo: false, deletedAt: new Date() },
      }),
    ]);
    res.json({ ok: true });
  },
);

export default router;
