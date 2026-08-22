// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // ── Errores de validación Zod ───────────────────────────────────────────
  if (err instanceof ZodError) {
    return res.status(422).json({
      ok: false,
      error: 'Datos de entrada inválidos',
      detalle: err.errors.map((e) => ({
        campo: e.path.join('.'),
        mensaje: e.message,
      })),
    });
  }

  // ── Errores de aplicación conocidos ────────────────────────────────────
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: err.message,
      code: err.code,
    });
  }

  // ── Errores de Prisma ───────────────────────────────────────────────────
  const prismaErr = err as any;
  if (prismaErr?.code === 'P2002') {
    return res.status(409).json({ ok: false, error: 'Ya existe un registro con estos datos', code: 'DUPLICATE' });
  }
  if (prismaErr?.code === 'P2025') {
    return res.status(404).json({ ok: false, error: 'Registro no encontrado', code: 'NOT_FOUND' });
  }
  // "Unknown argument"/"Unknown field" casi siempre significa que el Prisma
  // Client generado está desactualizado respecto al schema.prisma (falta
  // correr `npx prisma generate` tras un cambio de schema/migración). Se
  // detecta por nombre de error en vez de por código porque este tipo de
  // error no trae un `code` P-xxxx como los demás errores de Prisma.
  if (prismaErr?.name === 'PrismaClientValidationError' || /Unknown (argument|field)/i.test(prismaErr?.message ?? '')) {
    logger.error('Prisma Client desactualizado respecto al schema', { err, path: req.path, method: req.method });
    return res.status(500).json({
      ok: false,
      error: 'El servidor tiene el Prisma Client desactualizado. Ejecuta "npx prisma generate" (con el servidor detenido) y reinicia el backend.',
      ...(process.env.NODE_ENV !== 'production' ? { detalleTecnico: (err as Error)?.message } : {}),
    });
  }

  // ── Error genérico (no exponer detalles en producción) ──────────────────
  logger.error('Error no manejado', { err, path: req.path, method: req.method });

  return res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : (err as Error)?.message ?? 'Error desconocido',
  });
}
