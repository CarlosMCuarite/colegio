// src/config/firebase.ts
import admin from 'firebase-admin';
import { logger } from '../utils/logger';

let firebaseApp: admin.app.App | null = null;

export function initFirebase(): void {
  if (firebaseApp) return;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    logger.warn('⚠️  Firebase: variables de entorno incompletas. Las notificaciones FCM estarán deshabilitadas.');
    return;
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });

  logger.info('✅ Firebase Admin inicializado');
}

export function getMessaging(): admin.messaging.Messaging | null {
  if (!firebaseApp) return null;
  return admin.messaging(firebaseApp);
}
