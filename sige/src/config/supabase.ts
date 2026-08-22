// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Diagnóstico de arranque ───────────────────────────────────────────────────
// El error "new row violates row-level security policy" al subir a un bucket que
// SÍ existe casi siempre significa que SUPABASE_SERVICE_ROLE_KEY tiene pegada la
// anon key por error. Decodificamos el JWT (sin verificar firma, solo para leer
// el claim "role") y avisamos fuerte en los logs si no es "service_role".
function verificarRolDeKey(nombre: string, key: string | undefined) {
  if (!key) {
    logger.error(`${nombre} no está definida en .env — Storage y creación de usuarios fallarán.`);
    return;
  }
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'));
    if (nombre.includes('SERVICE') && payload.role !== 'service_role') {
      logger.error(
        `⚠️  ${nombre} parece ser la clave incorrecta (role="${payload.role}"). ` +
        `Debe ser la "service_role" key de Supabase (Project Settings → API), no la "anon" key. ` +
        `Esto causa el error "row-level security policy" al subir archivos aunque el bucket exista.`
      );
    }
  } catch {
    logger.warn(`No se pudo verificar el formato de ${nombre} (¿está bien copiada?).`);
  }
}
verificarRolDeKey('SUPABASE_SERVICE_ROLE_KEY', supabaseServiceKey);

// Cliente público (verifica tokens JWT de usuarios)
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (bypass RLS — solo para operaciones del backend)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Buckets de Storage — DEBEN coincidir EXACTAMENTE con los nombres reales creados
// en Supabase Storage. Si renombras un bucket en Supabase, actualiza aquí o usa
// las variables de entorno SUPABASE_STORAGE_BUCKET_*.
export const BUCKETS = {
  VOUCHERS:    process.env.SUPABASE_STORAGE_BUCKET_VOUCHERS    || 'vales',
  DOCUMENTOS:  process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTOS  || 'documentos',
  AVATARES:    process.env.SUPABASE_STORAGE_BUCKET_AVATARES    || 'avatares',
  LOGOS:       process.env.SUPABASE_STORAGE_BUCKET_LOGOS       || 'logos',
  BACKUPS:     process.env.SUPABASE_STORAGE_BUCKET_BACKUPS     || 'backups',
} as const;
