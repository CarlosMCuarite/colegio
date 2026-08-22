// src/middleware/tenant.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { RolNombre } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      colegioId?: string;
    }
  }
}

export function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) return next(); // rutas públicas

  if (user.rol === RolNombre.SUPERADMIN) {
    // Superadmin: usa header X-Colegio-Id si viene, si no queda undefined (puede ver todo)
    const headerColegioId = req.headers['x-colegio-id'] as string | undefined;
    req.colegioId = headerColegioId ?? undefined;
  } else {
    if (!user.colegioId) throw new AppError('Usuario sin colegio asignado', 403);
    req.colegioId = user.colegioId;
  }
  next();
}

// Fuerza que haya colegioId — NO aplicar a rutas de superadmin que operan globalmente
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  const user = req.user;
  // Superadmin sin colegioId puede operar globalmente — no bloquear
  if (user?.rol === RolNombre.SUPERADMIN && !req.colegioId) {
    return next();
  }
  if (!req.colegioId) {
    throw new AppError('Colegio no especificado', 400);
  }
  next();
}
