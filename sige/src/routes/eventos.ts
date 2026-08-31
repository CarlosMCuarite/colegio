// src/routes/eventos.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isStaff } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, EventoTipo, Prisma } from '@prisma/client';
import multer from 'multer';
import { BUCKETS } from '../config/supabase';
import { getSignedUrlFromStoredValue, uploadFile } from '../services/storageService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5 } });
router.use(authenticate, resolveTenant, requireTenant);

const eventoSchema = z.object({
  titulo:      z.string().min(3),
  descripcion: z.string().optional().nullable(),
  tipo:        z.nativeEnum(EventoTipo).default(EventoTipo.ACTIVIDAD),
  // z.coerce.date() en vez de z.string().datetime(): este último exige
  // ISO-8601 completo con sufijo "Z" y rechaza el formato que envía un
  // <input type="datetime-local"> (sin "Z"), causando 422 en toda creación
  // de evento. Misma causa raíz que Comunicados/Encuestas — ver CHANGELOG_V8.5.md.
  fechaInicio: z.coerce.date(),
  fechaFin:    z.coerce.date().optional().nullable(),
  todoElDia:   z.preprocess(v => v === 'false' ? false : v === 'true' ? true : v, z.boolean()).default(true),
  lugar:       z.string().optional().nullable(),
});

const incluirEvento = { creadoPor: { select: { nombres: true, apellidos: true } }, adjuntos: true } as const;
async function firmarAdjuntos(evento: any) {
  return { ...evento, adjuntos: await Promise.all((evento.adjuntos ?? []).map(async (a: any) => {
    try { return { ...a, url: await getSignedUrlFromStoredValue(BUCKETS.DOCUMENTOS, a.url), disponible: true }; }
    catch { return { ...a, url: null, disponible: false }; }
  })) };
}
function faltaMigracionAdjuntos(error: any) {
  return error?.code === 'P2021' || /evento_adjuntos/i.test(error?.message ?? '');
}
async function exigirTablaAdjuntos() {
  const resultado = await prisma.$queryRaw<Array<{ tabla: string | null }>>`SELECT to_regclass('public.evento_adjuntos')::text AS tabla`;
  if (!resultado[0]?.tabla) throw new AppError('Ejecuta docs/EVENTOS_ADJUNTOS.sql para habilitar adjuntos de eventos', 503);
}

// ── GET /eventos — Todos los roles, incluyendo chatbot ───────────────────────
router.get('/', async (req, res) => {
  const { desde, hasta, tipo, page = '1', limit = '50' } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId!, activo: true };
  if (tipo)  where.tipo = tipo as EventoTipo;
  if (desde || hasta) {
    where.fechaInicio = {};
    if (desde) where.fechaInicio.gte = new Date(desde);
    if (hasta) where.fechaInicio.lte = new Date(hasta);
  }
  const total = await prisma.evento.count({ where });
  let eventos: any[];
  try {
    eventos = await prisma.evento.findMany({ where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit), orderBy: { fechaInicio: 'asc' }, include: incluirEvento });
  } catch (error) {
    if (!faltaMigracionAdjuntos(error)) throw error;
    eventos = (await prisma.evento.findMany({ where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit), orderBy: { fechaInicio: 'asc' }, include: { creadoPor: { select: { nombres: true, apellidos: true } } } })).map(e => ({ ...e, adjuntos: [] }));
  }
  res.json({ ok: true, data: await Promise.all(eventos.map(firmarAdjuntos)), meta: { total } });
});

// ── GET /eventos/proximos — Para dashboard y chatbot ─────────────────────────
router.get('/proximos', async (req, res) => {
  const { dias = '30' } = req.query as Record<string,string>;
  // Igual que en el filtro del padre: se compara desde el INICIO DEL DÍA DE
  // HOY (medianoche UTC), no desde el instante exacto — si no, un evento de
  // día completo guardado como medianoche UTC "ya pasó" antes de que
  // amanezca en Perú (UTC-5) y desaparece de "próximos" prematuramente.
  const ahora = new Date();
  const inicioHoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  const hasta = new Date(inicioHoy);
  hasta.setUTCDate(hasta.getUTCDate() + parseInt(dias));
  const eventos = await prisma.evento.findMany({
    where: {
      colegioId:   req.colegioId!,
      activo:      true,
      fechaInicio: { gte: inicioHoy, lte: hasta },
    },
    orderBy: { fechaInicio: 'asc' },
    take: 10,
  });
  res.json({ ok: true, data: eventos });
});

// ── GET /eventos/hay-clases/:fecha ────────────────────────────────────────────
// Usado por chatbot: ¿hay clases mañana?
router.get('/hay-clases/:fecha', async (req, res) => {
  const fecha = new Date(req.params.fecha);
  const eventos = await prisma.evento.findMany({
    where: {
      colegioId: req.colegioId!,
      activo:    true,
      tipo:      { in: [EventoTipo.FERIADO, EventoTipo.SUSPENSION_CLASES] },
      fechaInicio: { lte: fecha },
      OR: [
        { fechaFin: null },
        { fechaFin: { gte: fecha } },
      ],
    },
  });
  res.json({ ok: true, hayClases: eventos.length === 0, eventos });
});

// ── GET /eventos/:id ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  let evento: any;
  try { evento = await prisma.evento.findFirst({ where: { id: req.params.id, colegioId: req.colegioId! }, include: incluirEvento }); }
  catch (error) {
    if (!faltaMigracionAdjuntos(error)) throw error;
    const base = await prisma.evento.findFirst({ where: { id: req.params.id, colegioId: req.colegioId! }, include: { creadoPor: { select: { nombres: true, apellidos: true } } } });
    evento = base ? { ...base, adjuntos: [] } : null;
  }
  if (!evento) throw new AppError('Evento no encontrado', 404);
  res.json({ ok: true, data: await firmarAdjuntos(evento) });
});

// ── POST /eventos ─────────────────────────────────────────────────────────────
router.post(
  '/',
  isStaff,
  upload.array('adjuntos', 5),
  auditar({ modulo: 'EVENTOS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const data = eventoSchema.parse(req.body);
    const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (archivos.length) await exigirTablaAdjuntos();
    const evento = await prisma.evento.create({
      data: {
        ...data,
        colegioId:   req.colegioId!,
        creadoPorId: req.user!.id,
        fechaInicio: data.fechaInicio,
        fechaFin:    data.fechaFin ?? null,
      } as Prisma.EventoUncheckedCreateInput,
    });
    const subidos = await Promise.all(archivos.map(file => uploadFile(BUCKETS.DOCUMENTOS, file.buffer, file.originalname, file.mimetype, `${req.colegioId}/eventos`)));
    if (subidos.length) try { await prisma.eventoAdjunto.createMany({ data: subidos.map((r, i) => ({ eventoId: evento.id, url: r.path, nombre: r.nombre, mimeType: archivos[i].mimetype, tamano: archivos[i].size })) }); }
    catch (error) { if (faltaMigracionAdjuntos(error)) throw new AppError('Ejecuta docs/EVENTOS_ADJUNTOS.sql para habilitar adjuntos de eventos', 503); throw error; }
    res.status(201).json({ ok: true, data: evento });
  },
);

// ── PATCH /eventos/:id ────────────────────────────────────────────────────────
router.patch(
  '/:id',
  isStaff,
  upload.array('adjuntos', 5),
  auditar({ modulo: 'EVENTOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const data = eventoSchema.partial().parse(req.body);
    const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (archivos.length) await exigirTablaAdjuntos();
    await prisma.evento.updateMany({
      where: { id: req.params.id, colegioId: req.colegioId! },
      data: {
        ...data,
        fechaInicio: data.fechaInicio ?? undefined,
        fechaFin:    data.fechaFin    ?? undefined,
      },
    });
    const subidos = await Promise.all(archivos.map(file => uploadFile(BUCKETS.DOCUMENTOS, file.buffer, file.originalname, file.mimetype, `${req.colegioId}/eventos`)));
    if (subidos.length) try { await prisma.eventoAdjunto.createMany({ data: subidos.map((r, i) => ({ eventoId: req.params.id, url: r.path, nombre: r.nombre, mimeType: archivos[i].mimetype, tamano: archivos[i].size })) }); }
    catch (error) { if (faltaMigracionAdjuntos(error)) throw new AppError('Ejecuta docs/EVENTOS_ADJUNTOS.sql para habilitar adjuntos de eventos', 503); throw error; }
    res.json({ ok: true });
  },
);

// ── DELETE /eventos/:id ───────────────────────────────────────────────────────
router.delete('/:id', isStaff, async (req, res) => {
  await prisma.evento.updateMany({
    where: { id: req.params.id, colegioId: req.colegioId! },
    data: { activo: false },
  });
  res.json({ ok: true });
});

export default router;
