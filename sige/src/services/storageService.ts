// src/services/storageService.ts
// Sube archivos a Supabase Storage con conversión automática PNG/JPG → WebP
import sharp from 'sharp';
import { supabaseAdmin, BUCKETS } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

const IMAGE_MIMETYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_WEBP_DIMENSION = 1920;

interface UploadResult {
  url: string;
  path: string;
  nombre: string;
  tamañoKB: number;
}

/**
 * Genera una URL firmada de corta duración para un archivo en un bucket
 * PRIVADO (como "vouchers"). A diferencia de getPublicUrl(), esto sí
 * funciona sin marcar el bucket como público — necesario para no exponer
 * comprobantes de pago con solo adivinar la URL.
 */
export async function getSignedUrl(bucket: Bucket, storagePath: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new AppError(`No se pudo generar el enlace del archivo: ${error?.message ?? 'desconocido'}`, 500);
  }
  return data.signedUrl;
}

/**
 * Sube un archivo al bucket indicado.
 * Si es imagen PNG/JPG, convierte a WebP antes de subir.
 */
export async function uploadFile(
  bucket: Bucket,
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  carpeta?: string,
): Promise<UploadResult> {
  let fileBuffer = buffer;
  let finalMime = mimetype;
  let finalExt = path.extname(originalName).toLowerCase();
  let finalName = path.basename(originalName, finalExt);

  // ── Conversión a WebP ────────────────────────────────────────────────────
  if (IMAGE_MIMETYPES.includes(mimetype) && mimetype !== 'image/webp') {
    try {
      fileBuffer = await sharp(buffer)
        .resize(MAX_WEBP_DIMENSION, MAX_WEBP_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
      finalMime = 'image/webp';
      finalExt = '.webp';
      logger.debug(`Imagen convertida a WebP: ${originalName}`);
    } catch (err) {
      logger.warn(`No se pudo convertir a WebP: ${originalName}`, err);
      // Continuar con el archivo original si falla la conversión
    }
  }

  const uniqueName = `${uuidv4()}${finalExt}`;
  const storagePath = carpeta ? `${carpeta}/${uniqueName}` : uniqueName;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: finalMime,
      upsert: false,
    });

  if (error) {
    // Diagnóstico claro para el error más común de configuración
    const msg = error.message || '';
    if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('policy')) {
      logger.error(
        `RLS bloqueó la subida al bucket "${bucket}". Verifica: ` +
        `1) SUPABASE_SERVICE_ROLE_KEY correcta en .env (no la anon key), ` +
        `2) el bucket "${bucket}" existe en Supabase Storage, ` +
        `3) ejecutar docs/SUPABASE_STORAGE_SETUP.sql en el SQL Editor de Supabase.`,
        error,
      );
      throw new AppError(
        `No se pudo subir el archivo: falta configurar el bucket "${bucket}" en Supabase. Ejecuta docs/SUPABASE_STORAGE_SETUP.sql y verifica SUPABASE_SERVICE_ROLE_KEY.`,
        500,
      );
    }
    if (msg.toLowerCase().includes('bucket not found')) {
      throw new AppError(`El bucket "${bucket}" no existe en Supabase Storage. Ejecuta docs/SUPABASE_STORAGE_SETUP.sql.`, 500);
    }
    throw new AppError(`Error al subir archivo: ${error.message}`, 500);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(storagePath);

  return {
    url:      urlData.publicUrl,
    path:     storagePath,
    nombre:   `${finalName}${finalExt}`,
    tamañoKB: Math.round(fileBuffer.byteLength / 1024),
  };
}

/** Verifica que todos los buckets requeridos existan (para diagnóstico al iniciar) */
export async function verificarBuckets(): Promise<{ ok: boolean; faltantes: string[] }> {
  const { data, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    logger.error('No se pudo verificar buckets de Storage — revisa SUPABASE_SERVICE_ROLE_KEY', error);
    return { ok: false, faltantes: Object.values(BUCKETS) };
  }
  const existentes = new Set((data ?? []).map(b => b.name));
  const faltantes = Object.values(BUCKETS).filter(b => !existentes.has(b));
  if (faltantes.length) {
    logger.warn(`Buckets faltantes en Supabase Storage: ${faltantes.join(', ')}. Ejecuta docs/SUPABASE_STORAGE_SETUP.sql`);
  }
  return { ok: faltantes.length === 0, faltantes };
}

/** Elimina un archivo del Storage */
export async function deleteFile(bucket: Bucket, filePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([filePath]);
  if (error) logger.warn(`No se pudo eliminar archivo: ${filePath}`, error);
}

// Re-export para uso en rutas
export { BUCKETS } from '../config/supabase';
