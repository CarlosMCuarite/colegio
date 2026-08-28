// src/routes/auth.ts
import { CookieOptions, Response, Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { AuditoriaAccion, RolNombre, Prisma } from '@prisma/client';

const router = Router();

const ACCESS_COOKIE = 'sige_access_token';
const REFRESH_COOKIE = 'sige_refresh_token';
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
};

function guardarSesion(res: Response, session: { access_token: string; refresh_token: string; expires_in?: number }) {
  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...cookieOptions,
    maxAge: (session.expires_in ?? 3600) * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function limpiarSesion(res: Response) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error || !data?.session) throw new AppError('Correo o contraseña incorrectos', 401);

  const usuario = await prisma.usuario.findUnique({
    where: { supabaseId: data.user.id },
    include: { colegio: { select: { id: true, nombre: true, logoUrl: true, estado: true, whatsappNumero: true, whatsappMensaje: true, whatsappHorario: true, colorPrimario: true, colorSecundario: true, slug: true } } },
  });
  if (!usuario) throw new AppError('Usuario no registrado en el sistema', 401);
  if (!usuario.activo) throw new AppError('Tu cuenta está desactivada. Contacta al administrador.', 403);
  if (usuario.rol !== RolNombre.SUPERADMIN) {
    if (!usuario.colegio) throw new AppError('Sin colegio asignado', 403);
    if (usuario.colegio.estado === 'SUSPENDIDO') throw new AppError('El colegio está suspendido. Contacta con soporte.', 403);
    if (usuario.colegio.estado === 'INACTIVO')   throw new AppError('El colegio está inactivo. Contacta con soporte.', 403);
  }
  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLogin: new Date() } });
  await prisma.auditoria.create({ data: { colegioId: usuario.colegioId, usuarioId: usuario.id, accion: AuditoriaAccion.LOGIN, modulo: 'AUTH', ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip, userAgent: req.headers['user-agent'] ?? null } as Prisma.AuditoriaUncheckedCreateInput }).catch(() => {});

  guardarSesion(res, data.session);
  res.json({ ok: true,
    usuario: { id: usuario.id, nombres: usuario.nombres, apellidos: usuario.apellidos, email: usuario.email, rol: usuario.rol, telefono: usuario.telefono, avatarUrl: usuario.avatarUrl, colegio: usuario.colegio } });
});

router.post('/logout', authenticate, async (req, res) => {
  await prisma.auditoria.create({ data: { colegioId: req.user!.colegioId, usuarioId: req.user!.id, accion: AuditoriaAccion.LOGOUT, modulo: 'AUTH', ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip } as Prisma.AuditoriaUncheckedCreateInput }).catch(() => {});
  try { await supabaseAdmin.auth.admin.signOut(req.user!.supabaseId); } catch {}
  limpiarSesion(res);
  res.json({ ok: true });
});

// ── POST /auth/recuperacion-admin ─────────────────────────────────────────────
// Ruta de emergencia, no enlazada desde ningún menú: permite restaurar la
// contraseña de una cuenta ADMINISTRADOR/SUPERADMIN cuando nadie puede iniciar
// sesión para hacerlo desde el panel. Protegida por un código fijo (puedes
// sobrescribirlo con la variable de entorno ADMIN_RECOVERY_CODE) y limitada
// por el mismo rate-limiter que el login para dificultar la fuerza bruta.
const ADMIN_RECOVERY_CODE      = process.env.ADMIN_RECOVERY_CODE      || '75764047';
// Ruta aparte, exclusiva para SUPERADMIN, con su propio código distinto — así
// una cuenta SUPERADMIN no depende del mismo código que usan los administradores
// de colegio.
const SUPERADMIN_RECOVERY_CODE = process.env.SUPERADMIN_RECOVERY_CODE || '7576404775764047';

const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[a-z]/, 'Debe contener al menos una minúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un símbolo');

async function restaurarPasswordDeEmergencia(req: any, res: any, email: string, nuevaPassword: string, rolesPermitidos: RolNombre[], descripcion: string) {
  const usuario = await prisma.usuario.findFirst({ where: { email, rol: { in: rolesPermitidos } } });
  // Mismo mensaje exista o no la cuenta, para no filtrar qué correos son admin/superadmin.
  if (!usuario) throw new AppError('No se pudo restaurar la contraseña con esos datos', 400);

  const { error } = await supabaseAdmin.auth.admin.updateUserById(usuario.supabaseId, { password: nuevaPassword });
  if (error) throw new AppError(`Error al restaurar la contraseña: ${error.message}`, 500);

  try { await supabaseAdmin.auth.admin.signOut(usuario.supabaseId); } catch {}

  await prisma.auditoria.create({
    data: {
      colegioId: usuario.colegioId, usuarioId: usuario.id, accion: AuditoriaAccion.ACTUALIZAR, modulo: 'AUTH',
      descripcion,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip,
    } as Prisma.AuditoriaUncheckedCreateInput,
  }).catch(() => {});

  res.json({ ok: true, mensaje: 'Contraseña restaurada. Ya puedes iniciar sesión con la nueva contraseña.' });
}

router.post('/recuperacion-admin', authLimiter, async (req, res) => {
  const { email, codigo, nuevaPassword } = z.object({
    email: z.string().email(), codigo: z.string().min(1), nuevaPassword: passwordSchema,
  }).parse(req.body);

  if (codigo !== ADMIN_RECOVERY_CODE) throw new AppError('Código inválido', 401);
  await restaurarPasswordDeEmergencia(req, res, email, nuevaPassword, [RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR], 'Contraseña restaurada vía ruta de recuperación de administrador');
});

// ── POST /auth/recuperacion-superadmin ────────────────────────────────────────
router.post('/recuperacion-superadmin', authLimiter, async (req, res) => {
  const { email, codigo, nuevaPassword } = z.object({
    email: z.string().email(), codigo: z.string().min(1), nuevaPassword: passwordSchema,
  }).parse(req.body);

  if (codigo !== SUPERADMIN_RECOVERY_CODE) throw new AppError('Código inválido', 401);
  await restaurarPasswordDeEmergencia(req, res, email, nuevaPassword, [RolNombre.SUPERADMIN], 'Contraseña restaurada vía ruta de recuperación de SuperAdmin');
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== 'string') throw new AppError('Sesión expirada', 401);
  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) throw new AppError('Sesión expirada', 401);
  guardarSesion(res, data.session);
  res.json({ ok: true });
});

router.get('/me', authenticate, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user!.id },
    select: { id: true, nombres: true, apellidos: true, email: true, rol: true, telefono: true, dni: true, direccion: true, avatarUrl: true, ultimoLogin: true, createdAt: true,
      colegio: { select: { id: true, nombre: true, logoUrl: true, estado: true, whatsappNumero: true, whatsappMensaje: true, whatsappHorario: true, colorPrimario: true, colorSecundario: true, slug: true } } },
  });
  if (!usuario) throw new AppError('Usuario no encontrado', 404);
  res.json({ ok: true, data: usuario });
});

router.patch('/fcm-token', authenticate, async (req, res) => {
  const { fcmToken } = z.object({ fcmToken: z.string() }).parse(req.body);
  await prisma.usuario.update({ where: { id: req.user!.id }, data: { fcmToken } });
  res.json({ ok: true });
});

router.post('/cambiar-password', authenticate, async (req, res) => {
  const { passwordActual, password } = z.object({
    passwordActual: z.string().min(1, 'La contraseña actual es requerida'),
    password: z.string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[a-z]/, 'Debe contener al menos una minúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número')
      .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un símbolo'),
  }).parse(req.body);

  if (passwordActual === password) throw new AppError('La nueva contraseña no puede ser igual a la actual', 400);

  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.id } });
  if (!usuario) throw new AppError('Usuario no encontrado', 404);

  // Verificar contraseña actual
  const { error: loginError } = await supabaseAdmin.auth.signInWithPassword({ email: usuario.email, password: passwordActual });
  if (loginError) throw new AppError('La contraseña actual es incorrecta', 401);

  // Cambiar contraseña
  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user!.supabaseId, { password });
  if (error) throw new AppError(`Error al cambiar contraseña: ${error.message}`, 500);

  // Cerrar todas las sesiones
  try { await supabaseAdmin.auth.admin.signOut(req.user!.supabaseId); } catch {}
  limpiarSesion(res);

  await prisma.auditoria.create({ data: { colegioId: req.user!.colegioId, usuarioId: req.user!.id, accion: AuditoriaAccion.ACTUALIZAR, modulo: 'AUTH', descripcion: 'Cambio de contraseña — sesiones cerradas', ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip } as Prisma.AuditoriaUncheckedCreateInput }).catch(() => {});

  res.json({ ok: true, mensaje: 'Contraseña actualizada. Inicia sesión nuevamente.' });
});

export default router;
