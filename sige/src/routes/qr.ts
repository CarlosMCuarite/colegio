// src/routes/qr.ts
// Módulo dedicado para el scanner QR de asistencia
// Acceso: Superadmin, Admin, Director, Secretaría
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isStaff, isDocente } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { qrLimiter } from '../middleware/rateLimiter';
import { AppError } from '../utils/AppError';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

// ── GET /qr/sesion — Info de la sesión actual de escaneo ─────────────────────
// Antes esta ruta heredaba el "isStaff" que aplica a TODO el router (escanear/
// gestionar sí debe ser solo staff), pero eso también bloqueaba a Docente con
// 403 al cargar su propio dashboard (llama a /qr/sesion para el KPI "Registrados
// hoy"). Es solo lectura de estadísticas del colegio, así que se abre a Docente
// también; el resto de rutas de este archivo sigue exigiendo isStaff más abajo.
router.get('/sesion', isDocente, async (req, res) => {
  const hoy = dayjs().format('YYYY-MM-DD');
  const [totalEstudiantes, registrados, stats, colegio] = await Promise.all([
    prisma.estudiante.count({ where: { colegioId: req.colegioId!, estado: 'ACTIVO', deletedAt: null } }),
    prisma.asistencia.count({ where: { colegioId: req.colegioId!, fecha: new Date(hoy) } }),
    prisma.asistencia.groupBy({
      by: ['estado'],
      where: { colegioId: req.colegioId!, fecha: new Date(hoy) },
      _count: true,
    }),
    prisma.colegio.findUnique({ where: { id: req.colegioId! }, select: { horaEntrada: true, horaTardanza: true, horaSalida: true } }),
  ]);
  res.json({
    ok: true,
    data: {
      fecha:           dayjs().format('DD/MM/YYYY'),
      totalEstudiantes,
      registrados,
      pendientes:      totalEstudiantes - registrados,
      stats,
      horaEntrada:     colegio?.horaEntrada  || '07:30',
      horaTardanza:    colegio?.horaTardanza || '08:00',
      horaSalida:      colegio?.horaSalida   || '13:00',
    },
  });
});

// ── POST /qr/escanear — Procesa el escaneo del QR ────────────────────────────
router.post('/escanear', isStaff, qrLimiter, async (req, res) => {
  const { codigoQR, aulaId, modo = 'ENTRADA' } = z.object({
    codigoQR: z.string().min(1),
    aulaId:   z.string().optional(),
    modo:     z.enum(['ENTRADA']).default('ENTRADA'),
  }).parse(req.body);

  const hoy = dayjs().format('YYYY-MM-DD');

  // Buscar estudiante por código QR (= DNI)
  const estudiante = await prisma.estudiante.findFirst({
    where: {
      codigoQR,
      colegioId: req.colegioId!,
      deletedAt: null,
      estado: { in: ['ACTIVO', 'SUSPENDIDO'] },
    },
    include: {
      matriculas: {
        where: { activa: true },
        include: { nivelGrado: true, seccion: true },
        take: 1,
      },
      padreEstudiantes: {
        where: { esPrincipal: true },
        include: { padre: { include: { usuario: { select: { fcmToken: true } } } } },
      },
    },
  });

  if (!estudiante) {
    return res.status(404).json({
      ok: false,
      error: 'Estudiante no encontrado',
      codigoQR,
    });
  }

  // Verificar si ya se registró hoy
  const yaRegistrado = await prisma.asistencia.findFirst({
    where: { colegioId: req.colegioId!, estudianteId: estudiante.id, fecha: new Date(hoy) },
  });

  if (yaRegistrado) {
    return res.json({
      ok: true,
      duplicado: true,
      mensaje: `${estudiante.nombres} ya fue registrado hoy (${yaRegistrado.estado})`,
      estudiante: {
        id:        estudiante.id,
        nombres:   estudiante.nombres,
        apellidos: estudiante.apellidos,
        fotoUrl:   estudiante.fotoUrl,
        grado:     estudiante.matriculas[0]?.nivelGrado.nombre,
        seccion:   estudiante.matriculas[0]?.seccion?.nombre,
      },
      asistencia: yaRegistrado,
    });
  }

  // Determinar estado según hora — configurable por colegio (Configuración → Institución)
  const ahora = dayjs();
  const colegio = await prisma.colegio.findUnique({ where: { id: req.colegioId! }, select: { horaTardanza: true } });
  const horaLimite = colegio?.horaTardanza || '08:00';
  const [limH, limM] = horaLimite.split(':').map(Number);
  const esTardanza = ahora.hour() > limH || (ahora.hour() === limH && ahora.minute() > limM);

  const asistencia = await prisma.asistencia.create({
    data: {
      colegioId:       req.colegioId!,
      estudianteId:    estudiante.id,
      aulaId:          aulaId ?? null,
      fecha:           new Date(hoy),
      estado:          esTardanza ? 'TARDANZA' : 'PRESENTE',
      horaLlegada:     ahora.toDate(),
      registradoPorId: req.user!.id,
      escaneadoViaQR:  true,
    } as Prisma.AsistenciaUncheckedCreateInput,
  });

  // Notificar padre en background
  const padre = estudiante.padreEstudiantes[0]?.padre;
  if (padre) {
    const emoji = esTardanza ? '⏰' : '✅';
    const estado = esTardanza ? 'con tardanza' : 'puntualmente';
    prisma.notificacion.create({
      data: {
        padreId: padre.id,
        tipo:    'ASISTENCIA',
        titulo:  `${emoji} ${estudiante.nombres} ingresó al colegio`,
        cuerpo:  `${estudiante.nombres} ${estudiante.apellidos} llegó ${estado} a las ${ahora.format('HH:mm')}`,
        datos:   { estudianteId: estudiante.id, ruta: '/padre/asistencia' },
      },
    }).catch(() => {});
  }

  res.status(201).json({
    ok: true,
    duplicado: false,
    mensaje: esTardanza
      ? `⏰ Tardanza registrada para ${estudiante.nombres}`
      : `✅ Asistencia registrada para ${estudiante.nombres}`,
    estudiante: {
      id:        estudiante.id,
      nombres:   estudiante.nombres,
      apellidos: estudiante.apellidos,
      fotoUrl:   estudiante.fotoUrl,
      grado:     estudiante.matriculas[0]?.nivelGrado.nombre,
      seccion:   estudiante.matriculas[0]?.seccion?.nombre,
    },
    asistencia,
  });
});

// ── GET /qr/registro-hoy — Lista de asistencia del día actual ────────────────
router.get('/registro-hoy', isStaff, async (req, res) => {
  const { aulaId, nivelGradoId } = req.query as Record<string,string>;
  const hoy = dayjs().format('YYYY-MM-DD');
  const where: any = { colegioId: req.colegioId!, fecha: new Date(hoy) };
  if (aulaId) where.aulaId = aulaId;

  const registros = await prisma.asistencia.findMany({
    where,
    orderBy: { horaLlegada: 'asc' },
    include: {
      estudiante: {
        select: { nombres: true, apellidos: true, fotoUrl: true, dni: true,
          matriculas: { where: { activa: true }, include: { nivelGrado: true, seccion: true }, take: 1 },
        },
      },
    },
  });
  res.json({ ok: true, data: registros, total: registros.length, fecha: hoy });
});

// ── GET /qr/sin-registrar — Estudiantes que aún no asistieron hoy ─────────────
router.get('/sin-registrar', isStaff, async (req, res) => {
  const hoy = dayjs().format('YYYY-MM-DD');
  const registradosIds = await prisma.asistencia.findMany({
    where: { colegioId: req.colegioId!, fecha: new Date(hoy) },
    select: { estudianteId: true },
  });
  const ids = registradosIds.map(r => r.estudianteId);

  const sinRegistrar = await prisma.estudiante.findMany({
    where: {
      colegioId: req.colegioId!,
      estado:    'ACTIVO',
      deletedAt: null,
      id: { notIn: ids },
    },
    include: {
      matriculas: { where: { activa: true }, include: { nivelGrado: true, seccion: true }, take: 1 },
    },
    orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
  });
  res.json({ ok: true, data: sinRegistrar, total: sinRegistrar.length });
});

// ── POST /qr/ausencia-masiva — Marcar ausentes a los no registrados ───────────
router.post('/ausencia-masiva', isStaff, async (req, res) => {
  const hoy = dayjs().format('YYYY-MM-DD');
  const registrados = await prisma.asistencia.findMany({
    where: { colegioId: req.colegioId!, fecha: new Date(hoy) },
    select: { estudianteId: true },
  });
  const registradosIds = registrados.map(r => r.estudianteId);

  const sinRegistrar = await prisma.estudiante.findMany({
    where: { colegioId: req.colegioId!, estado: 'ACTIVO', deletedAt: null, id: { notIn: registradosIds } },
    select: { id: true },
  });

  if (!sinRegistrar.length) return res.json({ ok: true, marcados: 0 });

  await prisma.asistencia.createMany({
    data: sinRegistrar.map(e => ({
      colegioId:       req.colegioId!,
      estudianteId:    e.id,
      fecha:           new Date(hoy),
      estado:          'AUSENTE' as const,
      registradoPorId: req.user!.id,
      escaneadoViaQR:  false,
    })) as Prisma.AsistenciaCreateManyInput[],
    skipDuplicates: true,
  });

  res.json({ ok: true, marcados: sinRegistrar.length });
});

export default router;
