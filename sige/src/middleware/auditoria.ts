// src/middleware/auditoria.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AuditoriaAccion } from '@prisma/client';
import { logger } from '../utils/logger';

interface AuditoriaOptions {
  modulo: string;
  accion: AuditoriaAccion;
  getRecursoId?: (req: Request) => string | undefined;
}

/**
 * Middleware factory que registra una entrada en la tabla de auditoría
 * después de que la respuesta fue enviada (no bloquea el flujo principal).
 */
export function auditar(opts: AuditoriaOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Ejecutar auditoría después de que el handler envíe la respuesta
    res.on('finish', () => {
      if (res.statusCode >= 400) return; // No auditar errores

      const recursoId = opts.getRecursoId?.(req);
      const colegioId = req.colegioId ?? req.user?.colegioId ?? undefined;

      prisma.auditoria.create({
        data: {
          colegioId:    colegioId ?? null,
          usuarioId:    req.user?.id ?? null,
          accion:       opts.accion,
          modulo:       opts.modulo,
          recursoId:    recursoId ?? null,
          recursoTipo:  opts.modulo,
          ip:           (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip,
          userAgent:    req.headers['user-agent'] ?? null,
        },
      }).catch((err) => logger.error('Error al registrar auditoría', err));
    });

    next();
  };
}
