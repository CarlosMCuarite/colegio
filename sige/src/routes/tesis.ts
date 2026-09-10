import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isSuperAdmin } from '../middleware/auth';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate, isSuperAdmin);

const indicadores = {
  asistencia_qr: { nombre: 'Asistencias registradas por QR', unidad: '%', direccion: 'SUBE' },
  morosidad: { nombre: 'Pagos con morosidad', unidad: '%', direccion: 'BAJA' },
  tiempo_notificacion_asistencia: { nombre: 'Tiempo de notificación al padre', unidad: 'min', direccion: 'BAJA' },
  notas_consultadas: { nombre: 'Notas consultadas por familias', unidad: '%', direccion: 'SUBE' },
  tiempo_notas: { nombre: 'Tiempo hasta consultar una nota', unidad: 'horas', direccion: 'BAJA' },
} as const;

type Indicador = keyof typeof indicadores;
const media = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

function normalCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? p : 1 - p;
}

// Wilcoxon de rangos con signo: exacto para muestras pequeñas y aproximación
// normal para muestras mayores. Nunca se consulta la tabla Auditoria.
function wilcoxon(antes: number[], despues: number[]) {
  const diffs = antes.map((v, i) => despues[i] - v).filter(d => Math.abs(d) > 1e-9);
  if (diffs.length < 2) return null;
  const ordered = diffs.map((d, i) => ({ d, i, abs: Math.abs(d), rank: 0 })).sort((a, b) => a.abs - b.abs);
  for (let i = 0; i < ordered.length;) {
    let j = i + 1;
    while (j < ordered.length && Math.abs(ordered[j].abs - ordered[i].abs) < 1e-9) j++;
    const rank = ((i + 1) + j) / 2;
    for (let k = i; k < j; k++) ordered[k].rank = rank;
    i = j;
  }
  const total = ordered.reduce((s, x) => s + x.rank, 0);
  const wPlus = ordered.filter(x => x.d > 0).reduce((s, x) => s + x.rank, 0);
  const w = Math.min(wPlus, total - wPlus);
  let pValor: number;
  if (ordered.length <= 20) {
    let extremos = 0;
    const combinaciones = 2 ** ordered.length;
    for (let mask = 0; mask < combinaciones; mask++) {
      let suma = 0;
      for (let i = 0; i < ordered.length; i++) if (mask & (1 << i)) suma += ordered[i].rank;
      if (Math.min(suma, total - suma) <= w + 1e-9) extremos++;
    }
    pValor = extremos / combinaciones;
  } else {
    const mu = total / 2;
    const sigma = Math.sqrt(ordered.length * (ordered.length + 1) * (2 * ordered.length + 1) / 24);
    pValor = Math.min(1, 2 * normalCdf(-Math.abs(wPlus - mu) / sigma));
  }
  return { prueba: 'Wilcoxon de rangos con signo', n: ordered.length, estadistico: w, pValor, significativo: pValor < 0.05 };
}

async function muestrasDespues(colegioId: string, indicador: Indicador) {
  if (indicador === 'asistencia_qr') {
    const rows = await prisma.asistencia.findMany({ where: { colegioId }, select: { fecha: true, escaneadoViaQR: true }, orderBy: { fecha: 'desc' }, take: 1000 });
    const dias = new Map<string, boolean[]>();
    rows.forEach(r => { const k = r.fecha.toISOString().slice(0, 10); dias.set(k, [...(dias.get(k) ?? []), r.escaneadoViaQR]); });
    return [...dias.values()].map(xs => 100 * xs.filter(Boolean).length / xs.length);
  }
  if (indicador === 'morosidad') {
    const rows = await prisma.pago.findMany({ where: { colegioId }, select: { estado: true }, orderBy: { createdAt: 'desc' }, take: 1000 });
    return rows.map(r => r.estado === 'PENDIENTE' || r.estado === 'RECHAZADO' ? 100 : 0);
  }
  if (indicador === 'tiempo_notificacion_asistencia') {
    const rows = await prisma.asistencia.findMany({ where: { colegioId, horaLlegada: { not: null }, notificadoEn: { not: null } }, select: { horaLlegada: true, notificadoEn: true }, orderBy: { notificadoEn: 'desc' }, take: 1000 });
    return rows.map(r => Math.max(0, (r.notificadoEn!.getTime() - r.horaLlegada!.getTime()) / 60000));
  }
  const notas = await prisma.nota.findMany({ where: { colegioId }, select: { updatedAt: true, visualizaciones: { select: { vistoEn: true }, orderBy: { vistoEn: 'asc' }, take: 1 } }, orderBy: { updatedAt: 'desc' }, take: 1000 });
  if (indicador === 'notas_consultadas') return notas.map(n => n.visualizaciones.length ? 100 : 0);
  return notas.filter(n => n.visualizaciones[0]).map(n => Math.max(0, (n.visualizaciones[0].vistoEn.getTime() - n.updatedAt.getTime()) / 3600000));
}

router.get('/indicadores', (_req, res) => res.json({ ok: true, data: indicadores }));

router.get('/lineas-base', async (req, res) => {
  const colegioId = z.string().min(1).parse(req.query.colegioId);
  const data = await prisma.tesisLineaBase.findMany({ where: { colegioId }, orderBy: [{ indicador: 'asc' }, { createdAt: 'asc' }] });
  res.json({ ok: true, data: data.map(x => ({ ...x, valorAntes: Number(x.valorAntes) })) });
});

router.post('/lineas-base', async (req, res) => {
  const input = z.object({ colegioId: z.string(), indicador: z.enum(Object.keys(indicadores) as [Indicador, ...Indicador[]]), valorAntes: z.coerce.number().finite(), unidad: z.string().min(1).max(20), observaciones: z.string().max(500).optional().nullable() }).parse(req.body);
  const colegio = await prisma.colegio.findUnique({ where: { id: input.colegioId }, select: { id: true } });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  const data = await prisma.tesisLineaBase.create({ data: {
    colegioId: input.colegioId,
    indicador: input.indicador,
    valorAntes: input.valorAntes,
    unidad: input.unidad,
    observaciones: input.observaciones ?? null,
  } });
  res.status(201).json({ ok: true, data: { ...data, valorAntes: Number(data.valorAntes) } });
});

router.delete('/lineas-base/:id', async (req, res) => {
  const row = await prisma.tesisLineaBase.findUnique({ where: { id: req.params.id } });
  if (!row) throw new AppError('Línea base no encontrada', 404);
  await prisma.tesisLineaBase.delete({ where: { id: row.id } });
  res.json({ ok: true });
});

router.get('/analisis', async (req, res) => {
  const colegioId = z.string().min(1).parse(req.query.colegioId);
  const lineas = await prisma.tesisLineaBase.findMany({ where: { colegioId }, orderBy: { createdAt: 'asc' } });
  const data = await Promise.all((Object.keys(indicadores) as Indicador[]).map(async indicador => {
    const antes = lineas.filter(x => x.indicador === indicador).map(x => Number(x.valorAntes));
    const disponibles = await muestrasDespues(colegioId, indicador);
    const n = Math.min(antes.length, disponibles.length);
    const despues = disponibles.slice(0, n).reverse();
    const antesPareado = antes.slice(-n);
    const valorAntes = media(antes);
    const valorDespues = media(disponibles);
    const cambio = valorAntes != null && valorDespues != null ? valorDespues - valorAntes : null;
    return {
      indicador, ...indicadores[indicador], valorAntes, valorDespues, cambio,
      mejora: cambio == null ? null : indicadores[indicador].direccion === 'SUBE' ? cambio > 0 : cambio < 0,
      observacionesAntes: antes.length, observacionesDespues: disponibles.length,
      prueba: wilcoxon(antesPareado, despues),
      advertencia: n < 2 ? 'Se necesitan al menos 2 observaciones antes y después para una prueba inferencial.' : null,
    };
  }));
  res.json({ ok: true, data, metodologia: 'Comparación descriptiva y Wilcoxon pareado (α = 0.05). Las observaciones se emparejan cronológicamente; valida esa correspondencia en tu ficha de recolección.' });
});

export default router;
