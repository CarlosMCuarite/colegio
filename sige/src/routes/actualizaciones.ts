import { Router } from 'express';
import multer from 'multer';
import { createHash } from 'crypto';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isSuperAdmin } from '../middleware/auth';
import { AppError } from '../utils/AppError';
import { BUCKETS } from '../config/supabase';
import { deleteFileStrict, getSignedUrl, uploadFile } from '../services/storageService';
import { compareBuild } from '../services/mobileReleaseService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 250 * 1024 * 1024 } });

router.get('/actual', async (req, res) => {
  const version = String(req.query.version ?? '0.0.0');
  const build = Number(req.query.build ?? 0);
  const release = await prisma.actualizacionMovil.findFirst({ where: { activa: true }, orderBy: { build: 'desc' } });
  if (!release) return res.json({ ok: true, data: null });
  const disponible = compareBuild(version, build, release.version, release.build);
  const requerida = disponible && (release.obligatoria || (release.versionMinima
    ? compareBuild(version, build, release.versionMinima, 0) : false));
  const url = disponible ? await getSignedUrl(BUCKETS.ACTUALIZACIONES, release.rutaArchivo, 900) : null;
  res.json({ ok: true, data: { ...release, disponible, requerida, url, rutaArchivo: undefined } });
});

router.use(authenticate, isSuperAdmin);
router.get('/', async (_req, res) => {
  const data = await prisma.actualizacionMovil.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ ok: true, data: data.map(item => ({ ...item, rutaArchivo: undefined })) });
});

router.post('/', upload.single('apk'), async (req, res) => {
  if (!req.file) throw new AppError('Selecciona un archivo APK', 422);
  const body = z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Usa una versión como 1.2.0'),
    build: z.coerce.number().int().positive(),
    notas: z.string().min(5, 'Describe los cambios de esta versión'),
    obligatoria: z.enum(['true', 'false']).default('false'),
    versionMinima: z.string().optional(),
  }).parse(req.body);
  const result = await uploadFile(BUCKETS.ACTUALIZACIONES, req.file.buffer, `${body.version}-${body.build}.apk`, req.file.mimetype, 'android');
  const sha256 = createHash('sha256').update(req.file.buffer).digest('hex');
  const created = await prisma.$transaction(async tx => {
    await tx.actualizacionMovil.updateMany({ where: { activa: true }, data: { activa: false } });
    return tx.actualizacionMovil.create({ data: {
      version: body.version, build: body.build, notas: body.notas,
      obligatoria: body.obligatoria === 'true', versionMinima: body.versionMinima || null,
      rutaArchivo: result.path, nombreArchivo: result.nombre,
      sha256, tamanoBytes: req.file!.size, creadaPorId: req.user!.id,
    } });
  });
  res.status(201).json({ ok: true, data: { ...created, rutaArchivo: undefined } });
});

router.patch('/:id/activar', async (req, res) => {
  const existente = await prisma.actualizacionMovil.findUnique({ where: { id: req.params.id } });
  if (!existente) throw new AppError('Versión no encontrada', 404);
  if (!existente.rutaArchivo || existente.tamanoBytes <= 0) {
    throw new AppError('Esta versión ya no conserva su APK y no puede activarse', 409);
  }
  const data = await prisma.$transaction(async tx => {
    await tx.actualizacionMovil.updateMany({ data: { activa: false } });
    return tx.actualizacionMovil.update({ where: { id: req.params.id }, data: { activa: true } });
  });
  res.json({ ok: true, data });
});

router.delete('/:id/archivo', async (req, res) => {
  const release = await prisma.actualizacionMovil.findUnique({ where: { id: req.params.id } });
  if (!release) throw new AppError('Versión no encontrada', 404);
  if (!release.rutaArchivo || release.tamanoBytes <= 0) {
    return res.json({ ok: true, data: { id: release.id, archivoEliminado: true } });
  }

  await deleteFileStrict(BUCKETS.ACTUALIZACIONES, release.rutaArchivo);
  const updated = await prisma.actualizacionMovil.update({
    where: { id: release.id },
    data: { rutaArchivo: '', tamanoBytes: 0, activa: false },
  });
  res.json({
    ok: true,
    mensaje: 'APK eliminado; la versión permanece en el historial',
    data: { ...updated, rutaArchivo: undefined, archivoEliminado: true },
  });
});

export default router;
