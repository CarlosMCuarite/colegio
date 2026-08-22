// src/utils/roles.ts
import { RolNombre } from '@prisma/client';

// Roles que SÍ dependen del plan contratado por el colegio (se configuran
// en SuperAdmin → Roles por Plan). Solo ADMINISTRADOR y PADRE quedan fuera
// de esta lista — esos dos siempre están permitidos sin importar el plan
// (son los roles mínimos para que un colegio funcione).
//
// Se usa en DOS lugares que deben quedar sincronizados:
//   1) POST /usuarios — evita crear una cuenta con un rol que el plan no cubre.
//   2) authenticate (middleware) — si el plan cambia DESPUÉS de que la cuenta
//      ya existía (ej. el colegio bajó de Premium a Básico), esta misma lista
//      es la que decide si esa cuenta se PAUSA (403, sin borrar nada) en el
//      siguiente login/petición, en vez de quedar huérfana con acceso que ya
//      no debería tener.
export const ROLES_OPCIONALES: RolNombre[] = [
  RolNombre.DIRECTOR, RolNombre.SECRETARIA, RolNombre.DOCENTE,
  RolNombre.AUXILIAR, RolNombre.PSICOLOGO, RolNombre.COORDINADOR,
  RolNombre.TUTOR, RolNombre.CONTADOR, RolNombre.ENFERMERIA,
];
