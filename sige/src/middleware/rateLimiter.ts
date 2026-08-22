// src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// El límite anterior (300/15min por IP) resultaba demasiado bajo en la
// práctica: varias computadoras del colegio suelen compartir una sola IP
// pública (NAT de la red del colegio), y la pantalla de QR de asistencia
// sondea el servidor cada 10s de forma continua durante horas — eso solo ya
// consume buena parte del cupo. Se sube bastante el límite general y se
// excluyen del conteo los endpoints de sondeo/lectura frecuente para que no
// se agote por uso normal (esto no es una API pública expuesta a abuso
// externo, es software interno autenticado).
const RUTAS_SIN_LIMITE = ['/health', '/qr/sesion'];

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes, intenta más tarde' },
  skip: (req) => RUTAS_SIN_LIMITE.some(r => req.path === r || req.path.endsWith(r)),
});

// Límite propio para el escáner QR de asistencia — puede recibir varios
// escaneos seguidos cuando hay una fila de alumnos entrando a la vez.
export const qrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muchos escaneos seguidos, espera un momento' },
});

// Limiter más estricto para login
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, error: 'Demasiados intentos de inicio de sesión' },
});
