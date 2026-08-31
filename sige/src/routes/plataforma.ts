// src/routes/plataforma.ts
// Configuración global de la plataforma SIGE — los datos de pago (Yape/Plin/
// Banco) que ve un administrador de colegio para pagar SU suscripción a la
// plataforma. Esto es independiente de los datos de pago del colegio (que
// usan los padres para pagar pensiones) — ese vive en Colegio.yapeNumero, etc.
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../utils/AppError';
import { RolNombre, Prisma } from '@prisma/client';
import { uploadFile, deleteFile, storagePathFromStoredUrl } from '../services/storageService';
import { BUCKETS } from '../config/supabase';

const router = Router();
router.use(authenticate);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

const configSchema = z.object({
  yapeNumero:        z.string().optional().nullable(),
  yapeTitular:       z.string().optional().nullable(),
  plinNumero:        z.string().optional().nullable(),
  plinTitular:       z.string().optional().nullable(),
  bancoNombre:       z.string().optional().nullable(),
  cuentaBancaria:    z.string().optional().nullable(),
  cuentaBancariaCCI: z.string().optional().nullable(),
});

const metodoSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  tipo: z.enum(['BILLETERA', 'BANCO', 'TARJETA', 'OTRO']).default('OTRO'),
  titular: z.string().trim().max(120).optional().nullable(),
  numeroCuenta: z.string().trim().max(120).optional().nullable(),
  cci: z.string().trim().max(40).optional().nullable(),
  activo: z.boolean().optional().default(true),
  orden: z.number().int().min(0).max(999).optional().default(0),
});

// ── GET /plataforma/config — cualquier usuario autenticado puede LEER esto ────
// (un admin de colegio necesita verlo para saber dónde pagar su suscripción).
router.get('/config', async (req, res) => {
  const config = await prisma.configuracionPlataforma.upsert({
    where: { id: 'global' }, create: { id: 'global' }, update: {},
  });
  const metodosCobro = await prisma.metodoCobroPlataforma.findMany({ orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
  res.json({ ok: true, data: { ...config, metodosCobro } });
});

router.post('/config/metodos', async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const data = metodoSchema.parse(req.body);
  const metodo = await prisma.metodoCobroPlataforma.create({ data: data as Prisma.MetodoCobroPlataformaCreateInput });
  res.status(201).json({ ok: true, data: metodo });
});

router.patch('/config/metodos/:id', async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const data = metodoSchema.partial().parse(req.body);
  const metodo = await prisma.metodoCobroPlataforma.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, data: metodo });
});

router.delete('/config/metodos/:id', async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const metodo = await prisma.metodoCobroPlataforma.findUnique({ where: { id: req.params.id } });
  if (!metodo) throw new AppError('Método de cobro no encontrado', 404);
  const pathAnterior = metodo.qrUrl ? storagePathFromStoredUrl(BUCKETS.LOGOS, metodo.qrUrl) : null;
  if (pathAnterior) await deleteFile(BUCKETS.LOGOS, pathAnterior);
  await prisma.metodoCobroPlataforma.delete({ where: { id: metodo.id } });
  res.json({ ok: true });
});

router.post('/config/metodos/:id/qr', upload.single('imagen'), async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  if (!req.file) throw new AppError('Imagen requerida', 400);
  const anterior = await prisma.metodoCobroPlataforma.findUnique({ where: { id: req.params.id } });
  if (!anterior) throw new AppError('Método de cobro no encontrado', 404);
  const result = await uploadFile(BUCKETS.LOGOS, req.file.buffer, req.file.originalname, req.file.mimetype, 'plataforma/metodos');
  const metodo = await prisma.metodoCobroPlataforma.update({ where: { id: anterior.id }, data: { qrUrl: result.url } });
  const pathAnterior = anterior.qrUrl ? storagePathFromStoredUrl(BUCKETS.LOGOS, anterior.qrUrl) : null;
  if (pathAnterior && pathAnterior !== result.path) await deleteFile(BUCKETS.LOGOS, pathAnterior);
  res.json({ ok: true, data: metodo });
});

// ── PATCH /plataforma/config — solo SuperAdmin puede EDITAR ──────────────────
router.patch('/config', async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const data = configSchema.parse(req.body);
  const config = await prisma.configuracionPlataforma.upsert({
    where: { id: 'global' }, create: { id: 'global', ...data } as Prisma.ConfiguracionPlataformaCreateInput, update: data,
  });
  res.json({ ok: true, data: config });
});

// ── POST /plataforma/config/qr — sube la imagen del QR (Yape/Plin/Banco) ─────
// Opcional: muchas apps de pago hoy en día solo permiten pagar escaneando un
// QR (no basta con el número). El campo `tipo` dice a cuál de los 3 corresponde.
router.post('/config/qr', upload.single('imagen'), async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const { tipo } = z.object({ tipo: z.enum(['yape', 'plin', 'banco']) }).parse(req.body);
  if (!req.file) throw new AppError('Imagen requerida', 400);
  const result = await uploadFile(BUCKETS.LOGOS, req.file.buffer, req.file.originalname, req.file.mimetype, 'plataforma');
  const campo = tipo === 'yape' ? 'yapeQrUrl' : tipo === 'plin' ? 'plinQrUrl' : 'bancoQrUrl';
  const config = await prisma.configuracionPlataforma.upsert({
    where: { id: 'global' }, create: { id: 'global', [campo]: result.url }, update: { [campo]: result.url },
  });
  res.json({ ok: true, data: config });
});

export default router;
