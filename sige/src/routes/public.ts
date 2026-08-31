// src/routes/public.ts
// Rutas SIN autenticación — portal institucional público por colegio
import { Router } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';
import { getSignedUrlFromStoredValue } from '../services/storageService';
import { BUCKETS } from '../config/supabase';

const router = Router();

// Verificación pública del carnet. Expone únicamente datos mínimos para que
// una institución pueda comprobar autenticidad sin revelar información médica.
router.get('/carnet/:codigo', async (req, res) => {
  const estudiante = await prisma.estudiante.findFirst({
    where: { codigoQR: req.params.codigo, deletedAt: null },
    select: {
      nombres: true, apellidos: true, fotoUrl: true, estado: true, codigoQR: true,
      colegio: { select: { nombre: true, logoUrl: true, slug: true } },
      matriculas: { where: { activa: true }, orderBy: { anoEscolar: 'desc' }, take: 1, select: { anoEscolar: true, nivelGrado: { select: { nombre: true } }, seccion: { select: { nombre: true } } } },
    },
  });
  if (!estudiante) throw new AppError('Carnet no válido o estudiante no encontrado', 404);
  res.json({ ok: true, data: estudiante });
});

// ── GET /public/colegio/:slug — Portal institucional ──────────────────────────
router.get('/colegio/:slug', async (req, res) => {
  const colegio = await prisma.colegio.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true, slug: true, nombre: true, nombreCorto: true,
      logoUrl: true, imagenPortada: true, colorPrimario: true, colorSecundario: true,
      historia: true, mision: true, vision: true, galeria: true,
      direccion: true, distrito: true, provincia: true, departamento: true,
      telefono: true, email: true, sitioWeb: true,
      whatsappNumero: true, whatsappHorario: true, whatsappMensaje: true,
      estado: true,
    },
  });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  if (colegio.estado === 'INACTIVO') throw new AppError('Este portal no está disponible', 404);

  // Eventos próximos y noticias públicas (comunicados marcados para todo el colegio)
  const [eventosProximos, comunicadosPublicos] = await Promise.all([
    prisma.evento.findMany({
      where: { colegioId: colegio.id, activo: true, fechaInicio: { gte: new Date() } },
      orderBy: { fechaInicio: 'asc' },
      take: 5,
      select: { id: true, titulo: true, descripcion: true, fechaInicio: true, fechaFin: true, tipo: true, lugar: true },
    }),
    prisma.comunicado.findMany({
      where: { colegioId: colegio.id, activo: true, paraElColegio: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, titulo: true, contenido: true, createdAt: true, adjuntoUrl: true },
    }),
  ]);

  const comunicadosConAdjunto = await Promise.all(comunicadosPublicos.map(async comunicado => ({
    ...comunicado,
    adjuntoUrl: comunicado.adjuntoUrl
      ? await getSignedUrlFromStoredValue(BUCKETS.DOCUMENTOS, comunicado.adjuntoUrl)
      : null,
  })));
  res.json({ ok: true, data: { ...colegio, eventosProximos, comunicadosPublicos: comunicadosConAdjunto } });
});

// ── GET /public/colegio/:slug/check — Verifica existencia (para resolver login) ─
router.get('/colegio/:slug/check', async (req, res) => {
  const colegio = await prisma.colegio.findUnique({
    where: { slug: req.params.slug },
    select: { id: true, slug: true, nombre: true, logoUrl: true, colorPrimario: true, colorSecundario: true, estado: true },
  });
  if (!colegio) return res.json({ ok: true, existe: false });
  res.json({ ok: true, existe: true, data: colegio });
});

export default router;
