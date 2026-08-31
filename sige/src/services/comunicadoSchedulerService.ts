import cron from 'node-cron';
import prisma from '../config/prisma';
import { notificarPadresComunicado } from '../routes/comunicados';
import { logger } from '../utils/logger';

/** Publica y notifica comunicados cuya fecha programada ya llegó. */
export function initComunicadoScheduler() {
  cron.schedule('* * * * *', async () => {
    const ahora = new Date();
    const pendientes = await prisma.comunicado.findMany({
      where: { activo: true, notificadoEn: null, publicadoEn: { lte: ahora } },
      take: 100,
    });
    for (const comunicado of pendientes) {
      const reservado = await prisma.comunicado.updateMany({
        where: { id: comunicado.id, notificadoEn: null },
        data: { notificadoEn: ahora },
      });
      if (reservado.count) await notificarPadresComunicado(comunicado, comunicado.colegioId).catch(err => logger.error('Error notificando comunicado programado', err));
    }
  }, { timezone: process.env.TZ || 'America/Lima' });
  logger.info('✅ Programador de comunicados activo (cada minuto)');
}
