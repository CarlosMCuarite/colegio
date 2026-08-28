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
const DOCUMENT_MIMETYPES = [...IMAGE_MIMETYPES, 'application/pdf'];
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
  const allowedMimes = bucket === BUCKETS.LOGOS || bucket === BUCKETS.AVATARES
    ? IMAGE_MIMETYPES
    : DOCUMENT_MIMETYPES;
  if (!allowedMimes.includes(mimetype)) {
    throw new AppError('Tipo de archivo no permitido', 422);
  }

  const isPdf = buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const contenidoValido = mimetype === 'application/pdf'
    ? isPdf
    : mimetype === 'image/png'
      ? isPng
      : (mimetype === 'image/jpeg' || mimetype === 'image/jpg')
        ? isJpeg
        : mimetype === 'image/webp' && isWebp;
  if (!contenidoValido) {
    throw new AppError('El contenido del archivo no coincide con su tipo declarado', 422);
  }

  let fileBuffer = buffer;
  let finalMime = mimetype;
  let finalExt = path.extname(originalName).toLowerCase();
  let finalName = path.basename(originalName, finalExt);

  // ── Conversión a WebP ────────────────────────────────────────────────────
  if (IMAGE_MIMETYPES.includes(mimetype)) {
    try {
      const imagen = sharp(buffer).resize(MAX_WEBP_DIMENSION, MAX_WEBP_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      fileBuffer = mimetype === 'image/webp' ? await imagen.toBuffer() : await imagen.webp({ quality: 82 }).toBuffer();
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

/** Extrae el path interno tanto de URLs públicas antiguas como de paths directos. */
export function storagePathFromStoredUrl(bucket: Bucket, storedValue: string): string | null {
  try {
    const pathname = new URL(storedValue).pathname;
    const markers = [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`, `/${bucket}/`];
    for (const marker of markers) {
      const idx = pathname.indexOf(marker);
      if (idx !== -1) return decodeURIComponent(pathname.slice(idx + marker.length));
    }
  } catch {
    const clean = storedValue.replace(/^\/+/, '');
    return clean.startsWith(`${bucket}/`) ? clean.slice(bucket.length + 1) : clean || null;
  }
  return null;
}

/** Convierte el valor persistido en una URL temporal apta para buckets privados. */
export async function getSignedUrlFromStoredValue(bucket: Bucket, storedValue: string, expiresInSeconds = 300): Promise<string> {
  const storagePath = storagePathFromStoredUrl(bucket, storedValue);
  if (!storagePath) throw new AppError('Ruta de archivo inválida', 500);
  return getSignedUrl(bucket, storagePath, expiresInSeconds);
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
