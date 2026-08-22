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
import { RolNombre } from '@prisma/client';
import { uploadFile } from '../services/storageService';
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

// ── GET /plataforma/config — cualquier usuario autenticado puede LEER esto ────
// (un admin de colegio necesita verlo para saber dónde pagar su suscripción).
router.get('/config', async (req, res) => {
  const config = await prisma.configuracionPlataforma.upsert({
    where: { id: 'global' }, create: { id: 'global' }, update: {},
  });
  res.json({ ok: true, data: config });
});

// ── PATCH /plataforma/config — solo SuperAdmin puede EDITAR ──────────────────
router.patch('/config', async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const data = configSchema.parse(req.body);
  const config = await prisma.configuracionPlataforma.upsert({
    where: { id: 'global' }, create: { id: 'global', ...data }, update: data,
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
