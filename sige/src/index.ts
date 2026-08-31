// =============================================================================
// SIGE · Backend Entry Point
// =============================================================================
import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { initFirebase } from './config/firebase';
import { initBackupCron } from './services/backupService';
import { initAuditoriaRetention } from './services/auditoriaRetentionService';
import { initComunicadoScheduler } from './services/comunicadoSchedulerService';
import { verificarBuckets } from './services/storageService';

// Rutas
import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import colegiosRoutes from './routes/colegios';
import usuariosRoutes from './routes/usuarios';
import estudiantesRoutes from './routes/estudiantes';
import padresRoutes from './routes/padres';
import matriculasRoutes from './routes/matriculas';
import asistenciaRoutes from './routes/asistencia';
import pagosRoutes from './routes/pagos';
import conceptosPagoRoutes from './routes/conceptosPago';
import pagosLicenciaRoutes from './routes/pagosLicencia';
import plataformaRoutes from './routes/plataforma';
import comunicadosRoutes from './routes/comunicados';
import eventosRoutes from './routes/eventos';
import encuestasRoutes from './routes/encuestas';
import observacionesRoutes from './routes/observaciones';
import permisosRoutes from './routes/permisosSalida';
import documentosRoutes from './routes/documentos';
import horariosRoutes from './routes/horarios';
import cursosRoutes from './routes/cursos';
import notasRoutes from './routes/notas';
import chatRoutes from './routes/chat';
import reportesRoutes from './routes/reportes';
import aulasRoutes from './routes/aulas';
import membresiasRoutes from './routes/membresias';
import auditoriaRoutes from './routes/auditoria';
import exportacionesRoutes from './routes/exportaciones';
import chatbotRoutes from './routes/chatbot';
import dashboardRoutes from './routes/dashboard';
import qrRoutes from './routes/qr';
import backupsRoutes from './routes/backups';

const app = express();
const PORT = process.env.PORT || 4000;
const allowedOrigins = Array.from(new Set([
  'http://localhost:3000',
  'https://sige-frontend-ygeu.onrender.com',
  ...(process.env.CORS_ORIGINS || '').split(','),
]
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)));

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// ─── Seguridad y parseo ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Las cookies se envían automáticamente: una petición que modifica datos debe
// proceder de uno de los frontends autorizados. Se permiten llamadas sin Origin
// para integraciones servidor-a-servidor y herramientas administrativas.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin?.replace(/\/$/, '');
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ ok: false, error: 'Origen no autorizado' });
  }
  next();
});
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(rateLimiter);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Rutas API ───────────────────────────────────────────────────────────────
const api = '/api/v1';

app.use(`${api}/auth`,          authRoutes);
app.use(`${api}/public`,        publicRoutes);
app.use(`${api}/colegios`,      colegiosRoutes);
app.use(`${api}/usuarios`,      usuariosRoutes);
app.use(`${api}/estudiantes`,   estudiantesRoutes);
app.use(`${api}/padres`,        padresRoutes);
app.use(`${api}/matriculas`,    matriculasRoutes);
app.use(`${api}/asistencia`,    asistenciaRoutes);
app.use(`${api}/pagos`,         pagosRoutes);
app.use(`${api}/conceptos-pago`, conceptosPagoRoutes);
app.use(`${api}/pagos-licencia`, pagosLicenciaRoutes);
app.use(`${api}/plataforma`,     plataformaRoutes);
app.use(`${api}/comunicados`,   comunicadosRoutes);
app.use(`${api}/eventos`,       eventosRoutes);
app.use(`${api}/encuestas`,     encuestasRoutes);
app.use(`${api}/observaciones`, observacionesRoutes);
app.use(`${api}/permisos`,      permisosRoutes);
app.use(`${api}/documentos`,    documentosRoutes);
app.use(`${api}/horarios`,      horariosRoutes);
app.use(`${api}/cursos`,        cursosRoutes);
app.use(`${api}/notas`,         notasRoutes);
app.use(`${api}/chat`,          chatRoutes);
app.use(`${api}/reportes`,      reportesRoutes);
app.use(`${api}/aulas`,         aulasRoutes);
app.use(`${api}/membresias`,    membresiasRoutes);
app.use(`${api}/auditoria`,     auditoriaRoutes);
app.use(`${api}/exportaciones`, exportacionesRoutes);
app.use(`${api}/chatbot`,       chatbotRoutes);
app.use(`${api}/dashboard`,     dashboardRoutes);
app.use(`${api}/qr`,            qrRoutes);
app.use(`${api}/backups`,       backupsRoutes);

// ─── Error handler (siempre al final) ───────────────────────────────────────
app.use(errorHandler);

// ─── Inicio ──────────────────────────────────────────────────────────────────
async function main() {
  try {
    initFirebase();
    // Diagnóstico al iniciar: si falta el bucket "backups" (u otro), lo dice
    // clarito en el log en vez de dejar que cada intento de respaldo falle
    // en silencio con un error de RLS que no explica la causa real.
    const buckets = await verificarBuckets();
    if (!buckets.ok) {
      logger.error(
        `❌ Faltan buckets en Supabase Storage: ${buckets.faltantes.join(', ')}. ` +
        `Ejecuta docs/SUPABASE_STORAGE_SETUP.sql en el SQL Editor de Supabase — ` +
        `sin el bucket "backups" creado, los respaldos SIEMPRE van a fallar.`,
      );
    }
    initBackupCron();
    initAuditoriaRetention();
    initComunicadoScheduler();
    app.listen(PORT, () => {
      logger.info(`🚀 SIGE Backend corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Error al iniciar el servidor', err);
    process.exit(1);
  }
}

main();

export default app;
