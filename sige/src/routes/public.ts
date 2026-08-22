// src/routes/public.ts
// Rutas SIN autenticación — portal institucional público por colegio
import { Router } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

const router = Router();

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

  res.json({ ok: true, data: { ...colegio, eventosProximos, comunicadosPublicos } });
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
