// src/config/prisma.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
  });

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;

  // Log queries lentas (> 500ms) en desarrollo
  (prisma as any).$on('query', (e: any) => {
    if (e.duration > 500) {
      logger.warn(`[Prisma SLOW] ${e.duration}ms — ${e.query}`);
    }
  });
}

export default prisma;
