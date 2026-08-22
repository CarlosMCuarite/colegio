// src/routes/conceptosPago.ts
// Catálogo de conceptos de pago (Pensión, Matrícula, Materiales, etc.) que la
// secretaría/administración define, y que luego se usan para generar los
// cargos (deuda) de cada mes.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isStaff } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AuditoriaAccion, PagoTipo, NivelEducativo } from '@prisma/client';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const conceptoSchema = z.object({
  nombre:          z.string().min(2),
  tipo:            z.nativeEnum(PagoTipo),
  monto:           z.coerce.number().positive(),
  descripcion:     z.string().optional().nullable(),
  // null/omitido = aplica a todos los niveles.
  nivelAplicable:  z.nativeEnum(NivelEducativo).optional().nullable(),
  // Meses del año (1-12) en que corresponde el cobro. Si se omite, se usa
  // marzo-diciembre (año escolar peruano típico).
  mesesAplicables: z.array(z.number().int().min(1).max(12)).optional(),
});

// ── GET /conceptos-pago ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { soloActivos } = req.query as Record<string, string>;
  const where: any = { colegioId: req.colegioId! };
  if (soloActivos === 'true') where.activo = true;
  const conceptos = await prisma.conceptoPago.findMany({ where, orderBy: { nombre: 'asc' } });
  res.json({ ok: true, data: conceptos });
});

// ── POST /conceptos-pago ──────────────────────────────────────────────────────
router.post('/', isStaff, auditar({ modulo: 'CONCEPTOS_PAGO', accion: AuditoriaAccion.CREAR }), async (req, res) => {
  const data = conceptoSchema.parse(req.body);
  const concepto = await prisma.conceptoPago.create({ data: { ...data, colegioId: req.colegioId! } });
  res.status(201).json({ ok: true, data: concepto });
});

// ── PATCH /conceptos-pago/:id ─────────────────────────────────────────────────
router.patch('/:id', isStaff, auditar({ modulo: 'CONCEPTOS_PAGO', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }), async (req, res) => {
  const data = conceptoSchema.partial().parse(req.body);
  await prisma.conceptoPago.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data });
  res.json({ ok: true });
});

// ── PATCH /conceptos-pago/:id/estado — activar/desactivar ────────────────────
router.patch('/:id/estado', isStaff, async (req, res) => {
  const { activo } = z.object({ activo: z.boolean() }).parse(req.body);
  await prisma.conceptoPago.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data: { activo } });
  res.json({ ok: true });
});

export default router;
