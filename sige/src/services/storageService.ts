// src/services/storageService.ts
// Sube archivos a Supabase Storage con conversión automática PNG/JPG → WebP
import sharp from 'sharp';
import { supabaseAdmin, BUCKETS } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

const IMAGE_MIMETYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
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
  // Acepta tanto paths nuevos como URLs públicas/firmadas guardadas por
  // versiones anteriores. Firmar una URL completa produce un enlace válido
  // sintácticamente, pero Supabase responde "Object not found" al abrirlo.
  const normalizedPath = storagePathFromStoredUrl(bucket, storagePath);
  if (!normalizedPath) throw new AppError('La ruta del archivo guardado es inválida', 422);

  const parts = normalizedPath.split('/');
  const fileName = parts.pop()!;
  const directory = parts.join('/');
  const { data: objects, error: listError } = await supabaseAdmin.storage.from(bucket).list(directory, { search: fileName, limit: 100 });
  if (listError) throw new AppError(`No se pudo verificar el archivo: ${listError.message}`, 500);
  if (!(objects ?? []).some(item => item.name === fileName)) {
    throw new AppError('El archivo ya no existe en el almacenamiento. Vuelve a adjuntarlo para continuar.', 404);
  }

  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(normalizedPath, expiresInSeconds);
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
  if (!allowedMimes.includes(mimetype) && mimetype !== 'application/octet-stream') {
    throw new AppError('Tipo de archivo no permitido', 422);
  }

  const isPdf = buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const brand = buffer.length >= 12 ? buffer.subarray(8, 12).toString('ascii') : '';
  const isHeif = buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
  const detectedMime = isPdf ? 'application/pdf'
    : isPng ? 'image/png'
      : isJpeg ? 'image/jpeg'
        : isWebp ? 'image/webp'
          : isHeif ? 'image/heic'
            : null;
  const actualAllowed = detectedMime != null && allowedMimes.includes(detectedMime);
  if (!actualAllowed) {
    throw new AppError('El contenido del archivo no coincide con su tipo declarado', 422);
  }

  let fileBuffer = buffer;
  let finalMime = detectedMime!;
  let finalExt = path.extname(originalName).toLowerCase();
  let finalName = path.basename(originalName, finalExt);

  // ── Conversión a WebP ────────────────────────────────────────────────────
  if (IMAGE_MIMETYPES.includes(detectedMime!)) {
    try {
      const imagen = sharp(buffer).resize(MAX_WEBP_DIMENSION, MAX_WEBP_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      fileBuffer = detectedMime === 'image/webp' ? await imagen.toBuffer() : await imagen.webp({ quality: 82 }).toBuffer();
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
  return getSignedUrl(bucket, storedValue, expiresInSeconds);
}

/** Verifica que todos los buckets requeridos existan (para diagnóstico al iniciar) */
const BUCKET_CONFIG: Record<string, { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] }> = {
  [BUCKETS.LOGOS]: { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: IMAGE_MIMETYPES },
  [BUCKETS.VOUCHERS]: { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: DOCUMENT_MIMETYPES },
  [BUCKETS.DOCUMENTOS]: { public: false, fileSizeLimit: 20 * 1024 * 1024, allowedMimeTypes: DOCUMENT_MIMETYPES },
  [BUCKETS.AVATARES]: { public: true, fileSizeLimit: 3 * 1024 * 1024, allowedMimeTypes: IMAGE_MIMETYPES },
  [BUCKETS.BACKUPS]: { public: false, fileSizeLimit: 50 * 1024 * 1024, allowedMimeTypes: ['application/json'] },
};

/**
 * Verifica y autocrea buckets faltantes. Render puede iniciar sobre un proyecto
 * Supabase recién configurado sin depender de una intervención manual. Esto no
 * sustituye una SERVICE_ROLE_KEY válida: si la clave es anon, Supabase bloqueará
 * correctamente la creación y el log indicará la variable exacta que corregir.
 */
export async function asegurarBuckets(): Promise<{ ok: boolean; faltantes: string[] }> {
  const { data, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    logger.error('No se pudo verificar buckets de Storage — revisa SUPABASE_SERVICE_ROLE_KEY', error);
    return { ok: false, faltantes: Object.values(BUCKETS) };
  }
  const existentes = new Set((data ?? []).map(b => b.name));
  const faltantesIniciales = Object.values(BUCKETS).filter(b => !existentes.has(b));
  for (const bucket of faltantesIniciales) {
    const config = BUCKET_CONFIG[bucket];
    const { error: createError } = await supabaseAdmin.storage.createBucket(bucket, config);
    if (createError) {
      logger.error(`No se pudo autocrear el bucket "${bucket}". Verifica SUPABASE_SERVICE_ROLE_KEY.`, createError);
    } else {
      logger.info(`Bucket de Storage autocreado: ${bucket}`);
      existentes.add(bucket);
    }
  }
  const faltantes = Object.values(BUCKETS).filter(b => !existentes.has(b));
  return { ok: faltantes.length === 0, faltantes };
}

export const verificarBuckets = asegurarBuckets;

/** Elimina un archivo del Storage */
export async function deleteFile(bucket: Bucket, filePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([filePath]);
  if (error) logger.warn(`No se pudo eliminar archivo: ${filePath}`, error);
}

// Re-export para uso en rutas
export { BUCKETS } from '../config/supabase';
