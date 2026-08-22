// src/services/notificacionService.ts
import { getMessaging } from '../config/firebase';
import prisma from '../config/prisma';
import { NotificacionTipo } from '@prisma/client';
import { logger } from '../utils/logger';

interface EnviarNotifParams {
  colegioId?: string;
  usuarioId?: string;
  padreId?: string;
  tipo: NotificacionTipo;
  titulo: string;
  cuerpo: string;
  datos?: Record<string, string>;
  fcmToken?: string;
}

export async function enviarNotificacion(params: EnviarNotifParams): Promise<void> {
  const { colegioId, usuarioId, padreId, tipo, titulo, cuerpo, datos, fcmToken } = params;

  // Guardar en BD siempre
  const notif = await prisma.notificacion.create({
    data: {
      usuarioId:  usuarioId ?? null,
      padreId:    padreId   ?? null,
      tipo,
      titulo,
      cuerpo,
      datos: datos ?? undefined,
    },
  });

  // Enviar via FCM si hay token
  const messaging = getMessaging();
  if (!messaging || !fcmToken) return;

  try {
    await messaging.send({
      token: fcmToken,
      notification: { title: titulo, body: cuerpo },
      data: datos,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    await prisma.notificacion.update({
      where: { id: notif.id },
      data: { enviadaFCM: true },
    });
  } catch (err) {
    logger.error('Error FCM al enviar notificación', err);
    await prisma.notificacion.update({
      where: { id: notif.id },
      data: { errorFCM: (err as Error).message },
    });
  }
}

/** Obtiene el token FCM de un usuario */
export async function getFCMToken(usuarioId: string): Promise<string | null> {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { fcmToken: true },
  });
  return u?.fcmToken ?? null;
}
