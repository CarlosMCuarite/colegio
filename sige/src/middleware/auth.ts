// src/middleware/auth.ts
// Verifica el JWT de Supabase Auth y carga el usuario desde la BD
import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { RolNombre } from '@prisma/client';

// Roles "adicionales" que el LOGIN valida contra el plan del colegio — ver
// el comentario dentro de authenticate() para por qué esta lista es más
// corta que ROLES_OPCIONALES (esa se usa solo al crear un usuario, acción
// explícita del Admin; esta se aplica en cada petición autenticada).
const ROLES_ADICIONALES_PLAN: RolNombre[] = [
  RolNombre.AUXILIAR, RolNombre.PSICOLOGO, RolNombre.COORDINADOR,
  RolNombre.TUTOR, RolNombre.CONTADOR, RolNombre.ENFERMERIA,
];

export interface AuthUser {
  id: string;           // ID interno (Prisma)
  supabaseId: string;
  colegioId: string | null;
  rol: RolNombre;
  nombres: string;
  apellidos: string;
  email: string;
}

// Extiende la Request de Express
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Token de autenticación requerido', 401);
  }

  const token = authHeader.split(' ')[1];

  // Verificar token con Supabase
  const { data: { user: supaUser }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !supaUser) {
    throw new AppError('Token inválido o expirado', 401);
  }

  // Cargar usuario desde nuestra BD
  const usuario = await prisma.usuario.findUnique({
    where: { supabaseId: supaUser.id },
    select: {
      id: true,
      supabaseId: true,
      colegioId: true,
      rol: true,
      nombres: true,
      apellidos: true,
      email: true,
      activo: true,
      colegio: { select: { estado: true, licenciaFin: true, plan: { select: { rolesHabilitados: true } } } },
    },
  });

  if (!usuario) throw new AppError('Usuario no encontrado en el sistema', 401);
  if (!usuario.activo) throw new AppError('Usuario desactivado', 403);

  // Enforcement en tiempo real: si el colegio fue suspendido/inactivado por el
  // SuperAdmin, ninguna petición posterior debe pasar, aunque el JWT siga vigente.
  if (usuario.rol !== RolNombre.SUPERADMIN) {
    if (usuario.colegio?.estado === 'SUSPENDIDO') throw new AppError('El colegio está suspendido. Contacta con soporte.', 403);
    if (usuario.colegio?.estado === 'INACTIVO')   throw new AppError('El colegio está inactivo. Contacta con soporte.', 403);

    // Licencia vencida: se bloquea a todos MENOS al Administrador (necesita
    // poder entrar para ver Facturación y renovar). Antes bajar la fecha de
    // licencia en SuperAdmin no tenía ningún efecto real — quedaba solo un
    // dato decorativo. Ahora si `licenciaFin` ya pasó, se aplica de verdad.
    const licenciaVencida = usuario.colegio?.licenciaFin && usuario.colegio.licenciaFin < new Date();
    if (licenciaVencida && usuario.rol !== RolNombre.ADMINISTRADOR) {
      throw new AppError('La licencia del colegio venció. Contacta al administrador de tu colegio.', 403);
    }

    // Rol vs. plan contratado: si el colegio bajó de plan (ej. de Premium a
    // Básico) y ese plan ya no incluye este rol, la cuenta NO se borra —
    // simplemente se pausa (403) hasta que el plan vuelva a incluirlo o el
    // usuario cambie de rol ("las cuentas no se eliminan, se paralizan").
    //
    // OJO: aquí, a propósito, solo se valida contra los roles claramente
    // "adicionales" (Auxiliar/Psicólogo/Coordinador/Tutor/Contador/
    // Enfermería) — NO Director/Secretaría/Docente. Esos tres son roles
    // base de cualquier colegio funcionando; bloquearlos en el LOGIN si el
    // `rolesHabilitados` del plan no los tiene explícitamente listados sería
    // arriesgado (un plan mal configurado dejaría a todos los profesores
    // afuera). El check de creación (POST /usuarios) sí es más estricto —
    // ahí es una acción explícita del Admin, con feedback inmediato.
    if (ROLES_ADICIONALES_PLAN.includes(usuario.rol)) {
      const rolesDelPlan = usuario.colegio?.plan?.rolesHabilitados ?? [];
      if (!rolesDelPlan.includes(usuario.rol)) {
        throw new AppError(`Tu rol (${usuario.rol}) no está incluido en el plan actual del colegio. Tu cuenta sigue existiendo — contacta al administrador para que actualice el plan o reasigne tu rol.`, 403);
      }
    }
  }

  req.user = usuario;
  next();
}

// ─── Guard de roles ──────────────────────────────────────────────────────────
export function requireRol(...roles: RolNombre[]) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!_req.user) throw new AppError('No autenticado', 401);
    if (!roles.includes(_req.user.rol)) {
      throw new AppError('No tienes permisos para esta operación', 403);
    }
    next();
  };
}

// Shortcuts para uso frecuente
export const isSuperAdmin  = requireRol(RolNombre.SUPERADMIN);
export const isAdmin       = requireRol(RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR);
export const isAdminDir    = requireRol(RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR);
export const isStaff       = requireRol(
  RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR, RolNombre.SECRETARIA
);
// isDocente: staff + cualquier rol que trabaja directo con alumnos/aulas
// (Docente y los roles opcionales tipo Docente: Auxiliar, Tutor, Coordinador,
// Psicólogo, Enfermería). Antes solo incluía DOCENTE a secas — por eso un
// usuario con rol Psicólogo o Enfermería podía ENTRAR a una pantalla en el
// frontend pero cada llamada a la API le devolvía 403.
export const isDocente     = requireRol(
  RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR,
  RolNombre.SECRETARIA, RolNombre.DOCENTE, RolNombre.AUXILIAR,
  RolNombre.TUTOR, RolNombre.COORDINADOR, RolNombre.PSICOLOGO, RolNombre.ENFERMERIA,
);
// isFinanzas: staff + Contador — para rutas de pagos/facturación. Se agrega
// como grupo centralizado (en vez de escribir el rol a mano en cada ruta)
// justamente por el patrón de bug que se repitió varias veces: un rol
// opcional (Psicólogo, Enfermería, Auxiliar y ahora Contador) se creaba en
// el sistema pero se quedaba afuera de los guards porque no había un solo
// lugar donde agregarlo — había que acordarse de tocar cada ruta una por
// una. Contador se había quedado así: el rol existía, pero ni siquiera
// isStaff lo incluía, así que no podía ver ni un pago.
export const isFinanzas    = requireRol(
  RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR,
  RolNombre.SECRETARIA, RolNombre.CONTADOR,
);
