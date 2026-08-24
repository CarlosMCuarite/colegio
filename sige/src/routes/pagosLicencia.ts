// src/routes/pagosLicencia.ts
// Pagos de suscripción: el ADMIN de un colegio sube su voucher de pago de
// licencia, y SuperAdmin lo aprueba/rechaza. Mismo patrón que Pago
// (pensiones), pero aquí el pagador es el colegio y el cobrador es la
// plataforma.
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, RolNombre, PagoEstado, Prisma } from '@prisma/client';
import { uploadFile, getSignedUrl, BUCKETS } from '../services/storageService';

const router = Router();
router.use(authenticate, resolveTenant);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function esAdminColegio(rol: RolNombre) {
  // Se anota el array como RolNombre[] (no un literal más angosto) — sin
  // esto, TypeScript infiere el tipo más estrecho posible a partir de los
  // dos valores del array, y `.includes(rol)` deja de aceptar la variable
  // `rol` (que es del tipo completo RolNombre) porque no coincide con ese
  // tipo angosto. Nunca se notó en local porque el dev normal usa ts-node
  // (más permisivo); recién se ve con el build limpio de producción.
  return ([RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR] as RolNombre[]).includes(rol);
}

// ── GET /pagos-licencia — SuperAdmin ve todos, admin de colegio ve los suyos ──
router.get('/', async (req, res) => {
  const { estado, colegioId, page = '1', limit = '30' } = req.query as Record<string, string>;
  const where: any = {};
  if (req.user!.rol === RolNombre.SUPERADMIN) {
    if (colegioId) where.colegioId = colegioId;
  } else if (esAdminColegio(req.user!.rol)) {
    where.colegioId = req.colegioId!;
  } else {
    throw new AppError('Sin acceso', 403);
  }
  if (estado) where.estado = estado as PagoEstado;

  const [total, pagos] = await Promise.all([
    prisma.pagoLicencia.count({ where }),
    prisma.pagoLicencia.findMany({
      where, skip: (parseInt(page) - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { colegio: { select: { nombre: true, slug: true } }, aprobadoPor: { select: { nombres: true, apellidos: true } } },
    }),
  ]);
  res.json({ ok: true, data: pagos, meta: { total } });
});

// ── POST /pagos-licencia — admin de colegio sube su voucher de suscripción ───
router.post('/', upload.single('voucher'), auditar({ modulo: 'PAGOS_LICENCIA', accion: AuditoriaAccion.CREAR }), async (req, res) => {
  if (!esAdminColegio(req.user!.rol)) throw new AppError('Sin acceso', 403);
  const { monto, periodoPago, banco, operacion } = z.object({
    monto:       z.coerce.number().positive(),
    periodoPago: z.string().optional(),
    banco:       z.string().optional(),
    operacion:   z.string().optional(),
  }).parse(req.body);

  let voucherUrl: string | undefined;
  let voucherNombre: string | undefined;
  if (req.file) {
    const result = await uploadFile(BUCKETS.VOUCHERS, req.file.buffer, req.file.originalname, req.file.mimetype, `licencias/${req.colegioId}`);
    voucherUrl = result.path;
    voucherNombre = result.nombre;
  }

  const pago = await prisma.pagoLicencia.create({
    data: {
      colegioId: req.colegioId!, monto, periodoPago, banco, operacion,
      voucherUrl, voucherNombre, fechaPago: voucherUrl ? new Date() : null,
      estado: voucherUrl ? PagoEstado.EN_REVISION : PagoEstado.PENDIENTE,
    } as Prisma.PagoLicenciaUncheckedCreateInput,
  });
  res.status(201).json({ ok: true, data: pago });
});

// ── GET /pagos-licencia/:id/voucher-url ───────────────────────────────────────
router.get('/:id/voucher-url', async (req, res) => {
  const where: any = { id: req.params.id };
  if (req.user!.rol !== RolNombre.SUPERADMIN) where.colegioId = req.colegioId!;
  const pago = await prisma.pagoLicencia.findFirst({ where });
  if (!pago?.voucherUrl) throw new AppError('Este pago no tiene voucher adjunto', 404);
  const url = await getSignedUrl(BUCKETS.VOUCHERS, pago.voucherUrl, 300);
  res.json({ ok: true, data: { url } });
});

// ── PATCH /pagos-licencia/:id/aprobar ─────────────────────────────────────────
router.patch('/:id/aprobar', auditar({ modulo: 'PAGOS_LICENCIA', accion: AuditoriaAccion.APROBAR, getRecursoId: r => r.params.id }), async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const pago = await prisma.pagoLicencia.update({
    where: { id: req.params.id },
    data: { estado: PagoEstado.APROBADO, aprobadoPorId: req.user!.id },
  });

  // Extiende la suscripción del colegio 30 días desde su vencimiento actual
  // (o desde hoy si ya estaba vencida), y la reactiva si estaba suspendida.
  const colegio = await prisma.colegio.findUnique({ where: { id: pago.colegioId } });
  if (colegio) {
    const base = colegio.licenciaFin && colegio.licenciaFin > new Date() ? colegio.licenciaFin : new Date();
    const nuevaFecha = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    await prisma.colegio.update({
      where: { id: colegio.id },
      data: {
        licenciaFin: nuevaFecha,
        estado: colegio.estado === 'SUSPENDIDO' ? 'ACTIVO' : colegio.estado,
      },
    });
    // Registro histórico (informativo, no es la fuente de verdad de vigencia).
    await prisma.licencia.create({
      data: {
        colegioId: colegio.id, planId: colegio.planId, estado: 'ACTIVA',
        fechaInicio: base, fechaFin: nuevaFecha,
        motivo: `Pago de suscripción aprobado (${pago.periodoPago ?? ''})`.trim(),
        creadoPorId: req.user!.id,
      } as Prisma.LicenciaUncheckedCreateInput,
    }).catch(() => {});
  }

  res.json({ ok: true, data: pago });
});

// ── PATCH /pagos-licencia/:id/rechazar ────────────────────────────────────────
router.patch('/:id/rechazar', auditar({ modulo: 'PAGOS_LICENCIA', accion: AuditoriaAccion.RECHAZAR, getRecursoId: r => r.params.id }), async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const { motivo } = z.object({ motivo: z.string().min(3) }).parse(req.body);
  const pago = await prisma.pagoLicencia.update({
    where: { id: req.params.id },
    data: { estado: PagoEstado.RECHAZADO, observaciones: motivo, aprobadoPorId: req.user!.id },
  });
  res.json({ ok: true, data: pago });
});

export default router;
