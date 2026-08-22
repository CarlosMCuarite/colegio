// src/routes/chat.ts
// Chat directo Padre ↔ Docente, con contexto por estudiante (no se mezclan
// hilos de hermanos distintos en una sola conversación). Sin WebSockets por
// ahora — el frontend hace polling cada pocos segundos mientras el chat está
// abierto, igual de simple que el resto del sistema y suficiente para el
// volumen de un colegio.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { AppError } from '../utils/AppError';
import { RolNombre } from '@prisma/client';
import { enviarNotificacion } from '../services/notificacionService';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

// ── GET /chat/contactos — con quién puede iniciar un chat el usuario actual ───
// Padre: los docentes/tutores de cada uno de sus hijos (con el contexto de
// cuál hijo). Docente: los padres de los estudiantes que tiene en sus aulas.
router.get('/contactos', async (req, res) => {
  const anoActual = new Date().getFullYear();

  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId! } });
    if (!padre) return res.json({ ok: true, data: [] });
    const hijos = await prisma.padreEstudiante.findMany({
      where: { padreId: padre.id, estado: 'APROBADO' },
      include: { estudiante: { select: { id: true, nombres: true, apellidos: true, fotoUrl: true } } },
    });
    const contactos = [];
    for (const h of hijos) {
      const matricula = await prisma.matricula.findFirst({ where: { estudianteId: h.estudianteId, activa: true, anoEscolar: anoActual }, select: { seccionId: true } });
      if (!matricula?.seccionId) continue;
      const docentes = await prisma.docenteAula.findMany({
        where: { activo: true, aula: { seccionId: matricula.seccionId } },
        include: { usuario: { select: { id: true, nombres: true, apellidos: true, avatarUrl: true, rol: true } } },
        distinct: ['usuarioId'],
      });
      for (const d of docentes) {
        contactos.push({ usuario: d.usuario, estudiante: h.estudiante, esTutor: d.esTutor });
      }
    }
    return res.json({ ok: true, data: contactos });
  }

  // Docente (o roles similares): padres de sus alumnos
  const aulas = await prisma.docenteAula.findMany({ where: { usuarioId: req.user!.id, activo: true }, select: { aulaId: true } });
  const aulaIds = aulas.map(a => a.aulaId);
  const matriculas = await prisma.matricula.findMany({
    where: { activa: true, anoEscolar: anoActual, seccion: { aulas: { some: { id: { in: aulaIds } } } } },
    include: { estudiante: { include: { padreEstudiantes: { where: { estado: 'APROBADO' }, include: { padre: { include: { usuario: { select: { id: true, nombres: true, apellidos: true, avatarUrl: true } } } } } } } } },
  });
  const contactos: any[] = [];
  for (const m of matriculas) {
    for (const pe of m.estudiante.padreEstudiantes) {
      if (pe.padre.usuario) contactos.push({ usuario: pe.padre.usuario, estudiante: { id: m.estudiante.id, nombres: m.estudiante.nombres, apellidos: m.estudiante.apellidos, fotoUrl: m.estudiante.fotoUrl } });
    }
  }
  res.json({ ok: true, data: contactos });
});

// ── GET /chat/conversaciones — lista de hilos del usuario, con no-leídos ──────
router.get('/conversaciones', async (req, res) => {
  const soyPadre = req.user!.rol === RolNombre.PADRE;
  const where = soyPadre ? { padreUsuarioId: req.user!.id } : { docenteUsuarioId: req.user!.id };
  const conversaciones = await prisma.conversacion.findMany({
    where,
    include: {
      padreUsuario:   { select: { id: true, nombres: true, apellidos: true, avatarUrl: true } },
      docenteUsuario: { select: { id: true, nombres: true, apellidos: true, avatarUrl: true, rol: true } },
      estudiante:     { select: { id: true, nombres: true, apellidos: true, fotoUrl: true } },
      _count: { select: { mensajes: { where: { leidoEn: null, NOT: { autorId: req.user!.id } } } } },
    },
    orderBy: { ultimoMensajeEn: 'desc' },
  });
  res.json({ ok: true, data: conversaciones });
});

// ── POST /chat/conversaciones — abre (o reutiliza) un hilo con un contacto ────
router.post('/conversaciones', async (req, res) => {
  const { usuarioId, estudianteId } = z.object({ usuarioId: z.string(), estudianteId: z.string() }).parse(req.body);
  const soyPadre = req.user!.rol === RolNombre.PADRE;
  const padreUsuarioId   = soyPadre ? req.user!.id : usuarioId;
  const docenteUsuarioId = soyPadre ? usuarioId : req.user!.id;

  // Verifica que la relación sea legítima: el estudiante debe ser hijo
  // aprobado de ese padre, y el docente debe tener asignada el aula de ese
  // estudiante — igual que /chat/contactos, para que no se pueda abrir un
  // chat con cualquiera por fuera de esa relación real.
  const anoActual = new Date().getFullYear();
  const matricula = await prisma.matricula.findFirst({ where: { estudianteId, activa: true, anoEscolar: anoActual }, select: { seccionId: true } });
  if (!matricula?.seccionId) throw new AppError('El estudiante no tiene matrícula activa', 400);
  const padre = await prisma.padre.findFirst({ where: { usuarioId: padreUsuarioId, colegioId: req.colegioId! } });
  const esHijo = padre && await prisma.padreEstudiante.findFirst({ where: { padreId: padre.id, estudianteId, estado: 'APROBADO' } });
  if (!esHijo) throw new AppError('Esa relación padre-estudiante no existe', 403);
  const esDocenteDelAula = await prisma.docenteAula.findFirst({ where: { usuarioId: docenteUsuarioId, activo: true, aula: { seccionId: matricula.seccionId } } });
  if (!esDocenteDelAula) throw new AppError('Ese docente no tiene asignada el aula de ese estudiante', 403);

  const conversacion = await prisma.conversacion.upsert({
    where: { padreUsuarioId_docenteUsuarioId_estudianteId: { padreUsuarioId, docenteUsuarioId, estudianteId } },
    create: { colegioId: req.colegioId!, padreUsuarioId, docenteUsuarioId, estudianteId },
    update: {},
    include: {
      padreUsuario:   { select: { id: true, nombres: true, apellidos: true, avatarUrl: true } },
      docenteUsuario: { select: { id: true, nombres: true, apellidos: true, avatarUrl: true, rol: true } },
      estudiante:     { select: { id: true, nombres: true, apellidos: true, fotoUrl: true } },
    },
  });
  res.status(201).json({ ok: true, data: conversacion });
});

async function verificarParticipante(conversacionId: string, usuarioId: string) {
  const c = await prisma.conversacion.findFirst({ where: { id: conversacionId, OR: [{ padreUsuarioId: usuarioId }, { docenteUsuarioId: usuarioId }] } });
  if (!c) throw new AppError('No tienes acceso a esta conversación', 403);
  return c;
}

// ── GET /chat/conversaciones/:id/mensajes ──────────────────────────────────────
router.get('/conversaciones/:id/mensajes', async (req, res) => {
  await verificarParticipante(req.params.id, req.user!.id);
  const mensajes = await prisma.mensaje.findMany({
    where: { conversacionId: req.params.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json({ ok: true, data: mensajes });
});

// ── POST /chat/conversaciones/:id/mensajes ─────────────────────────────────────
router.post('/conversaciones/:id/mensajes', async (req, res) => {
  const { contenido } = z.object({ contenido: z.string().min(1).max(2000) }).parse(req.body);
  const conversacion = await verificarParticipante(req.params.id, req.user!.id);

  const mensaje = await prisma.mensaje.create({
    data: { conversacionId: conversacion.id, autorId: req.user!.id, contenido },
  });
  await prisma.conversacion.update({
    where: { id: conversacion.id },
    data: { ultimoMensajeEn: mensaje.createdAt, ultimoMensajeTexto: contenido.slice(0, 120) },
  });

  const destinatarioId = req.user!.id === conversacion.padreUsuarioId ? conversacion.docenteUsuarioId : conversacion.padreUsuarioId;
  const autor = await prisma.usuario.findUnique({ where: { id: req.user!.id }, select: { nombres: true, apellidos: true, fcmToken: true } });
  enviarNotificacion({
    colegioId: req.colegioId!, usuarioId: destinatarioId, tipo: 'MENSAJE',
    titulo: `Mensaje de ${autor?.nombres}`, cuerpo: contenido.slice(0, 100),
    datos: { conversacionId: conversacion.id },
  }).catch(() => {});

  res.status(201).json({ ok: true, data: mensaje });
});

// ── PATCH /chat/conversaciones/:id/leido — marca todos los mensajes ajenos como leídos ─
router.patch('/conversaciones/:id/leido', async (req, res) => {
  await verificarParticipante(req.params.id, req.user!.id);
  await prisma.mensaje.updateMany({
    where: { conversacionId: req.params.id, leidoEn: null, NOT: { autorId: req.user!.id } },
    data: { leidoEn: new Date() },
  });
  res.json({ ok: true });
});

// ── GET /chat/no-leidos — total de mensajes sin leer, para el badge del sidebar ─
router.get('/no-leidos', async (req, res) => {
  const soyPadre = req.user!.rol === RolNombre.PADRE;
  const where = soyPadre ? { padreUsuarioId: req.user!.id } : { docenteUsuarioId: req.user!.id };
  const conversaciones = await prisma.conversacion.findMany({ where, select: { id: true } });
  const total = await prisma.mensaje.count({
    where: { conversacionId: { in: conversaciones.map(c => c.id) }, leidoEn: null, NOT: { autorId: req.user!.id } },
  });
  res.json({ ok: true, total });
});

export default router;
