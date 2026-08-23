// src/routes/chatbot.ts
// Chatbot conectado a datos reales del colegio
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isAdmin } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { AppError } from '../utils/AppError';
import { RolNombre, Prisma } from '@prisma/client';
import dayjs from 'dayjs';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

// ── POST /chatbot/consulta — Consulta del padre o admin ───────────────────────
router.post('/consulta', async (req, res) => {
  const { mensaje } = z.object({ mensaje: z.string().min(2) }).parse(req.body);
  const msg = mensaje.toLowerCase().trim();
  const colegioId = req.colegioId!;

  let respuesta = '';
  let tipo = 'GENERAL';

  // ─── Chatbot Padres ────────────────────────────────────────────────────────
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({
      where: { usuarioId: req.user!.id, colegioId },
      include: {
        padreEstudiantes: {
          include: {
            estudiante: {
              include: {
                matriculas: { where: { activa: true }, include: { nivelGrado: true, seccion: true }, take: 1 },
              },
            },
          },
        },
      },
    });
    if (!padre?.padreEstudiantes.length) {
      return res.json({ ok: true, respuesta: 'No tienes estudiantes vinculados. Contacta a secretaría.' });
    }

    const estudiante = padre.padreEstudiantes[0].estudiante;
    const nombre = estudiante.nombres;

    // ¿Asistió hoy?
    if (msg.includes('asistió') || msg.includes('asistio') || msg.includes('fue hoy') || msg.includes('fue al colegio')) {
      tipo = 'ASISTENCIA';
      const hoy = dayjs().format('YYYY-MM-DD');
      const asistencia = await prisma.asistencia.findFirst({
        where: { colegioId, estudianteId: estudiante.id, fecha: new Date(hoy) },
      });
      if (!asistencia) respuesta = `📋 Aún no hay registro de asistencia de ${nombre} para hoy.`;
      else if (asistencia.estado === 'PRESENTE') respuesta = `✅ ${nombre} asistió hoy al colegio. Llegó a las ${dayjs(asistencia.horaLlegada).format('HH:mm')}.`;
      else if (asistencia.estado === 'TARDANZA') respuesta = `⏰ ${nombre} llegó tarde hoy a las ${dayjs(asistencia.horaLlegada).format('HH:mm')}.`;
      else if (asistencia.estado === 'AUSENTE')  respuesta = `❌ ${nombre} no asistió hoy. Motivo: ${asistencia.motivoAusencia || 'no registrado'}.`;
      else respuesta = `📋 Estado de ${nombre} hoy: ${asistencia.estado}.`;
    }

    // ¿Cuánto debo?
    else if (msg.includes('debo') || msg.includes('deuda') || msg.includes('pago') || msg.includes('mora')) {
      tipo = 'PAGOS';
      const pendientes = await prisma.pago.findMany({
        where: { colegioId, padreId: padre.id, estado: { in: ['PENDIENTE', 'EN_REVISION'] } },
        include: { concepto: { select: { nombre: true } } },
      });
      if (!pendientes.length) respuesta = `✅ No tienes pagos pendientes. ¡Al día!`;
      else {
        const total = pendientes.reduce((s, p) => s + Number(p.monto), 0);
        const detalle = pendientes.map(p => `• ${p.concepto?.nombre || p.tipo}: S/ ${p.monto}`).join('\n');
        respuesta = `💰 Tienes ${pendientes.length} pago(s) pendiente(s):\n${detalle}\n\nTotal: S/ ${total.toFixed(2)}`;
      }
    }

    // ¿Hay clases mañana?
    else if (msg.includes('clases mañana') || msg.includes('clases manana') || msg.includes('mañana hay') || msg.includes('clases tomorrow')) {
      tipo = 'EVENTOS';
      const manana = dayjs().add(1, 'day').format('YYYY-MM-DD');
      const eventos = await prisma.evento.findMany({
        where: {
          colegioId, activo: true,
          tipo: { in: ['FERIADO', 'SUSPENSION_CLASES'] },
          fechaInicio: { lte: new Date(manana) },
          OR: [{ fechaFin: null }, { fechaFin: { gte: new Date(manana) } }],
        },
      });
      if (!eventos.length) respuesta = `✅ Sí hay clases mañana (${dayjs().add(1,'day').format('DD/MM/YYYY')}).`;
      else respuesta = `❌ No hay clases mañana. Motivo: ${eventos[0].titulo}.`;
    }

    // ¿Cuál es el horario?
    else if (msg.includes('horario')) {
      tipo = 'HORARIOS';
      const matricula = estudiante.matriculas[0];
      if (!matricula) { respuesta = `${nombre} no tiene matrícula activa.`; }
      else {
        const horarios = await prisma.horario.findMany({
          where: { colegioId, nivelGradoId: matricula.nivelGradoId, seccionId: matricula.seccionId, activo: true },
          orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
        });
        const dias = ['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const txt = horarios.map(h => `${dias[h.diaSemana]}: ${h.horaInicio}-${h.horaFin} ${h.materia}`).join('\n');
        respuesta = txt ? `📚 Horario de ${nombre}:\n${txt}` : 'No hay horario registrado.';
      }
    }

    // ¿Qué eventos hay?
    else if (msg.includes('evento') || msg.includes('actividad') || msg.includes('reunión') || msg.includes('reunion')) {
      tipo = 'EVENTOS';
      const eventos = await prisma.evento.findMany({
        where: { colegioId, activo: true, fechaInicio: { gte: new Date() } },
        orderBy: { fechaInicio: 'asc' },
        take: 5,
      });
      if (!eventos.length) respuesta = 'No hay eventos próximos registrados.';
      else {
        const txt = eventos.map(e => `• ${dayjs(e.fechaInicio).format('DD/MM')}: ${e.titulo}`).join('\n');
        respuesta = `📅 Próximos eventos:\n${txt}`;
      }
    }

    // Respuesta genérica
    else {
      // Buscar en FAQ personalizada del colegio
      const faq = await prisma.chatbotPregunta.findFirst({
        where: {
          colegioId, activo: true,
          pregunta: { contains: msg.split(' ').slice(0,3).join(' '), mode: 'insensitive' },
        },
      });
      respuesta = faq?.respuesta ?? `Lo siento, no entendí tu consulta. Puedes preguntarme sobre:\n• ¿Asistió hoy mi hijo?\n• ¿Cuánto debo?\n• ¿Hay clases mañana?\n• ¿Cuál es el horario?\n• ¿Qué eventos hay?`;
    }
  }

  // ─── Chatbot Administrativo ────────────────────────────────────────────────
  else {
    if (msg.includes('matrícula') || msg.includes('matricula')) {
      tipo = 'MATRICULAS';
      const año = new Date().getFullYear();
      const total = await prisma.matricula.count({ where: { colegioId, añoEscolar: año, activa: true } });
      respuesta = `📋 Matrículas activas ${año}: ${total}`;
    }
    else if (msg.includes('estudiante') || msg.includes('alumno')) {
      tipo = 'ESTUDIANTES';
      const total = await prisma.estudiante.count({ where: { colegioId, estado: 'ACTIVO', deletedAt: null } });
      respuesta = `👨‍🎓 Estudiantes activos: ${total}`;
    }
    else if (msg.includes('pago') || msg.includes('pendiente')) {
      tipo = 'PAGOS';
      const agg = await prisma.pago.aggregate({
        where: { colegioId, estado: { in: ['PENDIENTE', 'EN_REVISION'] } },
        _count: true, _sum: { monto: true },
      });
      respuesta = `💰 Pagos pendientes: ${agg._count} (Total: S/ ${Number(agg._sum.monto ?? 0).toFixed(2)})`;
    }
    else if (msg.includes('asistencia') || msg.includes('faltas')) {
      tipo = 'ASISTENCIA';
      const hoy = dayjs().format('YYYY-MM-DD');
      const stats = await prisma.asistencia.groupBy({
        by: ['estado'], where: { colegioId, fecha: new Date(hoy) }, _count: true,
      });
      const txt = stats.map(s => `${s.estado}: ${s._count}`).join(' | ');
      respuesta = `📊 Asistencia hoy: ${txt || 'Sin registros aún'}`;
    }
    else {
      const faq = await prisma.chatbotPregunta.findFirst({
        where: { colegioId, activo: true, pregunta: { contains: msg.split(' ').slice(0,3).join(' '), mode: 'insensitive' } },
      });
      respuesta = faq?.respuesta ?? 'Puedes consultarme sobre: matrículas, estudiantes, pagos pendientes, asistencia de hoy.';
    }
  }

  res.json({ ok: true, respuesta, tipo });
});

// ── CRUD de FAQ personalizada — Solo Admin ────────────────────────────────────
router.get('/faq', async (req, res) => {
  const faqs = await prisma.chatbotPregunta.findMany({
    where: { colegioId: req.colegioId!, activo: true },
    orderBy: { categoria: 'asc' },
  });
  res.json({ ok: true, data: faqs });
});

router.post('/faq', isAdmin, async (req, res) => {
  const data = z.object({
    pregunta:  z.string().min(5),
    respuesta: z.string().min(5),
    categoria: z.string().optional(),
  }).parse(req.body);
  const faq = await prisma.chatbotPregunta.create({
    data: { ...data, colegioId: req.colegioId! } as Prisma.ChatbotPreguntaUncheckedCreateInput,
  });
  res.status(201).json({ ok: true, data: faq });
});

router.patch('/faq/:id', isAdmin, async (req, res) => {
  const data = z.object({ pregunta: z.string().optional(), respuesta: z.string().optional(), activo: z.boolean().optional() }).parse(req.body);
  await prisma.chatbotPregunta.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data });
  res.json({ ok: true });
});

router.delete('/faq/:id', isAdmin, async (req, res) => {
  await prisma.chatbotPregunta.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data: { activo: false } });
  res.json({ ok: true });
});

export default router;
