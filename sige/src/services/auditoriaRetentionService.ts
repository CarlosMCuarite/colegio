import cron from 'node-cron';
import { AuditoriaAccion } from '@prisma/client';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';

const AUTH_DIAS = Math.max(30, parseInt(process.env.AUDITORIA_AUTH_RETENCION_DIAS || '90', 10));
const OPERACIONES_DIAS = Math.max(365, parseInt(process.env.AUDITORIA_RETENCION_DIAS || '730', 10));
const CRON = process.env.AUDITORIA_LIMPIEZA_CRON || '15 4 * * *';

export async function limpiarAuditoriaAntigua(): Promise<number> {
  const ahora = Date.now();
  const authAntesDe = new Date(ahora - AUTH_DIAS * 86400000);
  const operacionesAntesDe = new Date(ahora - OPERACIONES_DIAS * 86400000);
  const accionesAuth = [AuditoriaAccion.LOGIN, AuditoriaAccion.LOGOUT];

  const [auth, operaciones] = await prisma.$transaction([
    prisma.auditoria.deleteMany({
      where: { accion: { in: accionesAuth }, createdAt: { lt: authAntesDe } },
    }),
    prisma.auditoria.deleteMany({
      where: { accion: { notIn: accionesAuth }, createdAt: { lt: operacionesAntesDe } },
    }),
  ]);
  const total = auth.count + operaciones.count;
  if (total) logger.info(`🧹 Auditoría: ${total} registro(s) vencido(s) eliminado(s).`);
  return total;
}

export function initAuditoriaRetention(): void {
  if (!cron.validate(CRON)) throw new Error(`AUDITORIA_LIMPIEZA_CRON inválido: "${CRON}"`);
  const timezone = process.env.BACKUP_TIMEZONE || 'America/Lima';
  cron.schedule(CRON, () => {
    limpiarAuditoriaAntigua().catch(err => logger.warn('No se pudo aplicar la retención de auditoría.', err));
  }, { timezone });
  // Render puede reiniciar el servicio fuera del horario programado. Esta
  // pasada inicial garantiza que la retención también se cumpla tras despertar.
  setTimeout(() => limpiarAuditoriaAntigua().catch(err => logger.warn('Retención inicial de auditoría omitida.', err)), 15000);
  logger.info(`✅ Retención de auditoría activa — accesos: ${AUTH_DIAS} días · operaciones: ${OPERACIONES_DIAS} días`);
}
