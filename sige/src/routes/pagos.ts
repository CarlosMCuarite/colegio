// src/routes/pagos.ts
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../config/prisma';
import { authenticate, isFinanzas } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, PagoEstado, PagoTipo, RolNombre, Prisma } from '@prisma/client';
import { uploadFile, getSignedUrlFromStoredValue, deleteFile, storagePathFromStoredUrl, BUCKETS } from '../services/storageService';
import { enviarNotificacion } from '../services/notificacionService';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Generación automática de cargos mensuales para un padre ─────────────────
// Se ejecuta cada vez que un padre consulta sus pagos: revisa, para cada hijo
// activo, qué conceptos le corresponden según el nivel educativo, y crea el
// cargo PENDIENTE de cada mes ya transcurrido del año escolar que aún no
// exista — así el padre ve automáticamente "debo marzo, abril..." sin que
// Secretaría tenga que generarlo manualmente mes a mes (aunque ese botón
// manual también sigue disponible para casos puntuales).
async function generarCargosAutomaticosPadre(colegioId: string, padreId: string): Promise<void> {
  const anoActual = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1; // 1-12

  const hijos = await prisma.padreEstudiante.findMany({
    where: { padreId, estudiante: { colegioId, estado: 'ACTIVO', deletedAt: null } },
    select: {
      estudianteId: true,
      estudiante: {
        select: { matriculas: { where: { activa: true, anoEscolar: anoActual }, select: { nivelGrado: { select: { nivel: true } } }, take: 1 } },
      },
    },
  });
  const hijosConNivel = hijos
    .map(h => ({ estudianteId: h.estudianteId, nivel: h.estudiante.matriculas[0]?.nivelGrado?.nivel }))
    .filter(h => h.nivel); // solo hijos con matrícula activa este año
  if (!hijosConNivel.length) return;

  const nivelesPresentes = Array.from(new Set(hijosConNivel.map(h => h.nivel)));
  const conceptos = await prisma.conceptoPago.findMany({
    where: { colegioId, activo: true, OR: [{ nivelAplicable: null }, { nivelAplicable: { in: nivelesPresentes as any } }] },
  });
  if (!conceptos.length) return;

  // Un cargo por CADA hijo (no uno solo por familia), para que dos hermanos
  // en el mismo nivel puedan después tener montos distintos si hace falta
  // (descuento por hermanos, beca, etc. — se ajusta luego con PATCH /pagos/:id/monto).
  const porGenerar: { estudianteId: string; conceptoId: string; periodoPago: string; monto: any; tipo: PagoTipo }[] = [];
  for (const hijo of hijosConNivel) {
    for (const c of conceptos) {
      if (c.nivelAplicable && c.nivelAplicable !== hijo.nivel) continue;
      const meses = (c.mesesAplicables?.length ? c.mesesAplicables : [1,2,3,4,5,6,7,8,9,10,11,12]).filter(m => m <= mesActual);
      for (const mes of meses) {
        porGenerar.push({ estudianteId: hijo.estudianteId, conceptoId: c.id, periodoPago: `${anoActual}-${String(mes).padStart(2, '0')}`, monto: c.monto, tipo: c.tipo });
      }
    }
  }
  if (!porGenerar.length) return;

  const existentes = await prisma.pago.findMany({
    where: { colegioId, padreId, estudianteId: { in: hijosConNivel.map(h => h.estudianteId) }, periodoPago: { in: porGenerar.map(p => p.periodoPago) } },
    select: { estudianteId: true, conceptoId: true, periodoPago: true },
  });
  const existentesSet = new Set(existentes.map(e => `${e.estudianteId}|${e.conceptoId}|${e.periodoPago}`));
  const faltantes = porGenerar.filter(p => !existentesSet.has(`${p.estudianteId}|${p.conceptoId}|${p.periodoPago}`));
  if (!faltantes.length) return;

  await prisma.pago.createMany({
    data: faltantes.map(p => ({ colegioId, padreId, estudianteId: p.estudianteId, conceptoId: p.conceptoId, tipo: p.tipo, monto: p.monto, periodoPago: p.periodoPago, estado: 'PENDIENTE' as const })),
  });
}

// ─── GET /pagos ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { estado, padreId, periodoPago, q, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: any = { colegioId: req.colegioId };
  if (estado)      where.estado      = estado as PagoEstado;
  if (periodoPago) where.periodoPago = periodoPago;
  if (q?.trim()) {
    where.OR = [
      { padre:      { OR: [{ nombres: { contains: q, mode: 'insensitive' } }, { apellidos: { contains: q, mode: 'insensitive' } }, { dni: { contains: q } }] } },
      { estudiante: { OR: [{ nombres: { contains: q, mode: 'insensitive' } }, { apellidos: { contains: q, mode: 'insensitive' } }, { dni: { contains: q } }] } },
    ];
  }

  // Si es padre, solo ve sus propios pagos
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({
      where: { usuarioId: req.user!.id, colegioId: req.colegioId! },
    });
    if (!padre) throw new AppError('Perfil de padre no encontrado', 404);
    where.padreId = padre.id;
    // Genera automáticamente los cargos del mes/meses ya transcurridos que
    // aún no existan, para que el padre vea de una vez cuánto debe.
    await generarCargosAutomaticosPadre(req.colegioId!, padre.id).catch(() => {});
  } else if (padreId) {
    where.padreId = padreId;
  }

  const [total, pagos, agregados] = await Promise.all([
    prisma.pago.count({ where }),
    prisma.pago.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: [{ padre: { apellidos: 'asc' } }, { periodoPago: 'asc' }],
      include: {
        padre:     { select: { nombres: true, apellidos: true, dni: true } },
        estudiante:{ select: { nombres: true, apellidos: true } },
        concepto:  { select: { nombre: true, nivelAplicable: true } },
        aprobadoPor: { select: { nombres: true, apellidos: true } },
      },
    }),
    prisma.pago.groupBy({ by: ['estado'], where: { colegioId: req.colegioId }, _count: true, _sum: { monto: true } }),
  ]);

  res.json({ ok: true, data: pagos, meta: { total, agregados } });
});

// ─── POST /pagos — Padre sube voucher ────────────────────────────────────────
router.post(
  '/',
  upload.single('voucher'),
  auditar({ modulo: 'PAGOS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const schema = z.object({
      conceptoId:  z.string().optional(),
      tipo:        z.nativeEnum(PagoTipo),
      monto:       z.coerce.number().positive(),
      periodoPago: z.string().optional(),
      banco:       z.string().optional(),
      operacion:   z.string().optional(),
    });
    const data = schema.parse(req.body);

    // Resolver padreId
    let padreId: string;
    if (req.user!.rol === RolNombre.PADRE) {
      const padre = await prisma.padre.findFirst({
        where: { usuarioId: req.user!.id, colegioId: req.colegioId! },
      });
      if (!padre) throw new AppError('Perfil de padre no encontrado', 404);
      padreId = padre.id;
    } else {
      padreId = z.string().parse(req.body.padreId);
    }

    // Subir voucher si viene
    let voucherUrl: string | undefined;
    let voucherNombre: string | undefined;
    if (req.file) {
      const result = await uploadFile(
        BUCKETS.VOUCHERS,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        `${req.colegioId}/${padreId}`,
      );
      voucherUrl    = result.path; // guardamos el PATH, no la url pública — el bucket es privado, se firma al vuelo al verlo
      voucherNombre = result.nombre;
    }

    const pago = await prisma.pago.create({
      data: {
        colegioId:    req.colegioId!,
        padreId,
        tipo:         data.tipo,
        monto:        data.monto,
        conceptoId:   data.conceptoId,
        periodoPago:  data.periodoPago,
        banco:        data.banco,
        operacion:    data.operacion,
        estado:       voucherUrl ? PagoEstado.EN_REVISION : PagoEstado.PENDIENTE,
        voucherUrl,
        voucherNombre,
      } as Prisma.PagoUncheckedCreateInput,
    });

    res.status(201).json({ ok: true, data: pago });
  },
);

// ─── POST /pagos/generar — Secretaría genera el cargo (deuda) del mes ────────
// Crea un registro PENDIENTE por cada ESTUDIANTE activo al que le corresponda
// el concepto (según su nivel), para el período dado. Si ya existe un cargo
// para ese estudiante+concepto+periodo, no lo duplica. Genera por estudiante
// (no por familia) para que hermanos con montos distintos (descuentos, becas)
// se puedan ajustar cada uno por separado con PATCH /pagos/:id/monto.
router.post(
  '/generar',
  isFinanzas,
  auditar({ modulo: 'PAGOS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const { conceptoId, periodoPago, estudianteIds } = z.object({
      conceptoId:    z.string(),
      periodoPago:   z.string().min(4),
      // Si no se especifica, se genera para todos los estudiantes activos a
      // los que les corresponda el concepto según su nivel.
      estudianteIds: z.array(z.string()).optional(),
    }).parse(req.body);

    const concepto = await prisma.conceptoPago.findFirst({ where: { id: conceptoId, colegioId: req.colegioId! } });
    if (!concepto) throw new AppError('Concepto de pago no encontrado', 404);

    let objetivos: { estudianteId: string; padreId: string }[];
    if (estudianteIds?.length) {
      const rels = await prisma.padreEstudiante.findMany({
        where: { estudianteId: { in: estudianteIds }, estudiante: { colegioId: req.colegioId! } },
        select: { estudianteId: true, padreId: true },
      });
      objetivos = rels;
    } else {
      const matriculasActivas = await prisma.matricula.findMany({
        where: {
          activa: true,
          estudiante: { colegioId: req.colegioId!, estado: 'ACTIVO', deletedAt: null },
          ...(concepto.nivelAplicable ? { nivelGrado: { nivel: concepto.nivelAplicable } } : {}),
        },
        select: { estudianteId: true },
      });
      const estudianteIdsMatriculados = Array.from(new Set(matriculasActivas.map(m => m.estudianteId)));
      const rels = await prisma.padreEstudiante.findMany({
        where: { estudianteId: { in: estudianteIdsMatriculados } },
        select: { estudianteId: true, padreId: true },
      });
      objetivos = rels;
    }

    if (!objetivos.length) return res.json({ ok: true, generados: 0 });

    const yaExisten = await prisma.pago.findMany({
      where: { colegioId: req.colegioId!, conceptoId, periodoPago, estudianteId: { in: objetivos.map(o => o.estudianteId) } },
      select: { estudianteId: true },
    });
    const yaExistenSet = new Set(yaExisten.map(p => p.estudianteId));
    const pendientes = objetivos.filter(o => !yaExistenSet.has(o.estudianteId));

    if (!pendientes.length) return res.json({ ok: true, generados: 0, mensaje: 'Ya existía un cargo para todos los estudiantes seleccionados en ese período' });

    await prisma.pago.createMany({
      data: pendientes.map(({ estudianteId, padreId }) => ({
        colegioId:   req.colegioId!,
        padreId,
        estudianteId,
        conceptoId,
        tipo:        concepto.tipo,
        monto:       concepto.monto,
        periodoPago,
        estado:      'PENDIENTE' as const,
      })) as Prisma.PagoCreateManyInput[],
    });

    res.status(201).json({ ok: true, generados: pendientes.length });
  },
);

// ─── PATCH /pagos/:id/subir-voucher — Padre adjunta el voucher a un cargo ────
// pendiente (o vuelve a intentar tras un rechazo), en vez de crear un pago
// suelto sin relación con la deuda real.
router.patch(
  '/:id/subir-voucher',
  upload.single('voucher'),
  auditar({ modulo: 'PAGOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    if (!req.file) throw new AppError('Debes adjuntar el voucher', 400);

    const where: any = { id: req.params.id, colegioId: req.colegioId! };
    if (req.user!.rol === RolNombre.PADRE) {
      const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId! } });
      if (!padre) throw new AppError('Perfil de padre no encontrado', 404);
      where.padreId = padre.id;
    }

    const pago = await prisma.pago.findFirst({ where });
    if (!pago) throw new AppError('Pago no encontrado', 404);
    if (pago.estado === 'APROBADO' || pago.estado === 'EN_REVISION') {
      throw new AppError('Este pago ya tiene un voucher en revisión o ya fue aprobado', 409);
    }

    const { banco, operacion } = z.object({
      banco:     z.string().optional(),
      operacion: z.string().optional(),
    }).parse(req.body);

    const result = await uploadFile(BUCKETS.VOUCHERS, req.file.buffer, req.file.originalname, req.file.mimetype, `${req.colegioId}/${pago.padreId}`);

    if (pago.voucherUrl) {
      const anterior = storagePathFromStoredUrl(BUCKETS.VOUCHERS, pago.voucherUrl);
      if (anterior && anterior !== result.path) await deleteFile(BUCKETS.VOUCHERS, anterior);
    }

    const updated = await prisma.pago.update({
      where: { id: pago.id },
      data: {
        voucherUrl: result.path, voucherNombre: result.nombre,
        banco, operacion, fechaPago: new Date(),
        estado: 'EN_REVISION', observaciones: null,
      },
    });
    res.json({ ok: true, data: updated });
  },
);

// ─── PATCH /pagos/:id/monto — Ajustar el monto de un cargo puntual ───────────
// Para casos especiales: descuento por hermanos, beca, convenio particular,
// etc. Solo aplica a cargos que el padre todavía no pagó (PENDIENTE o
// RECHAZADO) — un pago ya en revisión o aprobado no se puede tocar.
router.patch(
  '/:id/monto',
  isFinanzas,
  auditar({ modulo: 'PAGOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const { monto, motivo } = z.object({
      monto:  z.coerce.number().positive(),
      motivo: z.string().min(3, 'Indica el motivo del ajuste (ej. "Descuento por hermanos")'),
    }).parse(req.body);

    const pago = await prisma.pago.findFirst({ where: { id: req.params.id, colegioId: req.colegioId! } });
    if (!pago) throw new AppError('Pago no encontrado', 404);
    if (!['PENDIENTE', 'RECHAZADO'].includes(pago.estado)) {
      throw new AppError('Solo se puede ajustar el monto de un cargo pendiente o rechazado', 409);
    }

    const updated = await prisma.pago.update({
      where: { id: pago.id },
      data: {
        monto,
        montoOriginal:    pago.montoOriginal ?? pago.monto, // conserva el primer monto original, no lo pisa en ajustes sucesivos
        montoAjustadoPor: req.user!.id,
        motivoAjuste:     motivo,
      },
    });
    res.json({ ok: true, data: updated });
  },
);

// ─── GET /pagos/:id/voucher-url — URL firmada (5 min) para ver el voucher ────
// El bucket "vouchers" es privado a propósito (son comprobantes de pago).
// En vez de guardar una URL pública fija, se genera una firmada al momento
// de pedirla, y solo si quien la pide es el padre dueño del pago o personal
// del colegio.
router.get('/:id/voucher-url', async (req, res) => {
  const where: any = { id: req.params.id, colegioId: req.colegioId! };
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId! } });
    if (!padre) throw new AppError('Perfil de padre no encontrado', 404);
    where.padreId = padre.id;
  }
  const pago = await prisma.pago.findFirst({ where });
  if (!pago?.voucherUrl) throw new AppError('Este pago no tiene voucher adjunto', 404);
  const url = await getSignedUrlFromStoredValue(BUCKETS.VOUCHERS, pago.voucherUrl, 300);
  res.json({ ok: true, data: { url } });
});

// ─── PATCH /pagos/:id/aprobar ─────────────────────────────────────────────────
router.patch(
  '/:id/aprobar',
  isFinanzas,
  auditar({ modulo: 'PAGOS', accion: AuditoriaAccion.APROBAR, getRecursoId: (r) => r.params.id }),
  async (req, res) => {
    const pago = await prisma.pago.findFirst({
      where: { id: req.params.id, colegioId: req.colegioId! },
      include: { padre: { include: { usuario: { select: { fcmToken: true } } } } },
    });
    if (!pago) throw new AppError('Pago no encontrado', 404);
    if (pago.estado === PagoEstado.APROBADO) throw new AppError('El pago ya fue aprobado', 409);

    const updated = await prisma.pago.update({
      where: { id: req.params.id },
      data: {
        estado:          PagoEstado.APROBADO,
        aprobadoPorId:   req.user!.id,
        fechaAprobacion: new Date(),
        notificadoPadre: true,
      },
    });

    // Notificar al padre
    await enviarNotificacion({
      colegioId: req.colegioId!,
      padreId:   pago.padreId,
      tipo:      'PAGO',
      titulo:    '✅ Pago aprobado',
      cuerpo:    `Tu pago de S/ ${pago.monto} ha sido aprobado`,
      fcmToken:  pago.padre.usuario?.fcmToken ?? undefined,
    });

    res.json({ ok: true, data: updated });
  },
);

// ─── PATCH /pagos/:id/rechazar ────────────────────────────────────────────────
router.patch(
  '/:id/rechazar',
  isFinanzas,
  auditar({ modulo: 'PAGOS', accion: AuditoriaAccion.RECHAZAR, getRecursoId: (r) => r.params.id }),
  async (req, res) => {
    const { observaciones } = z.object({ observaciones: z.string().min(5) }).parse(req.body);

    const pago = await prisma.pago.findFirst({
      where: { id: req.params.id, colegioId: req.colegioId! },
      include: { padre: { include: { usuario: { select: { fcmToken: true } } } } },
    });
    if (!pago) throw new AppError('Pago no encontrado', 404);

    await prisma.pago.update({
      where: { id: req.params.id },
      data: { estado: PagoEstado.RECHAZADO, observaciones, notificadoPadre: true },
    });

    await enviarNotificacion({
      colegioId: req.colegioId!,
      padreId:   pago.padreId,
      tipo:      'PAGO',
      titulo:    '❌ Pago rechazado',
      cuerpo:    `Tu pago fue rechazado. Motivo: ${observaciones}`,
      fcmToken:  pago.padre.usuario?.fcmToken ?? undefined,
    });

    res.json({ ok: true });
  },
);

export default router;
