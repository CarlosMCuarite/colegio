// src/routes/asistencia.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isStaff, isDocente } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, AsistenciaEstado, RolNombre, Prisma } from '@prisma/client';
import { enviarNotificacion } from '../services/notificacionService';
import dayjs from 'dayjs';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

// ─── POST /asistencia/qr ─────────────────────────────────────────────────────
// Registro vía escaneo QR (solo staff con acceso a /qr)
router.post(
  '/qr',
  isStaff,
  auditar({ modulo: 'ASISTENCIA_QR', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const schema = z.object({
      codigoQR: z.string(), // DNI del estudiante
      aulaId:   z.string().optional(),
    });
    const { codigoQR, aulaId } = schema.parse(req.body);
    const hoy = dayjs().format('YYYY-MM-DD');

    // Buscar estudiante por QR (= DNI)
    const estudiante = await prisma.estudiante.findFirst({
      where: { codigoQR, colegioId: req.colegioId!, deletedAt: null },
      include: {
        padreEstudiantes: {
          where: { esPrincipal: true },
          include: { padre: { include: { usuario: { select: { fcmToken: true } } } } },
        },
      },
    });
    if (!estudiante) throw new AppError('Estudiante no encontrado con ese código QR', 404);

    // Verificar si ya tiene asistencia hoy
    const asistenciaExistente = await prisma.asistencia.findFirst({
      where: { colegioId: req.colegioId!, estudianteId: estudiante.id, fecha: new Date(hoy) },
    });
    if (asistenciaExistente) {
      return res.json({ ok: true, data: asistenciaExistente, mensaje: 'Asistencia ya registrada hoy' });
    }

    const horaLlegada = new Date();
    // Antes esto SIEMPRE marcaba PRESENTE (había un TODO pendiente). Ahora
    // compara contra colegio.horaTardanza (configurable en Configuración del
    // colegio) para marcar TARDANZA automáticamente si llegó después.
    const colegioConf = await prisma.colegio.findUnique({ where: { id: req.colegioId! }, select: { horaTardanza: true } });
    const [hLim, mLim] = (colegioConf?.horaTardanza ?? '08:00').split(':').map(Number);
    const limiteHoy = new Date(horaLlegada);
    limiteHoy.setHours(hLim, mLim, 0, 0);
    const estado = horaLlegada > limiteHoy ? AsistenciaEstado.TARDANZA : AsistenciaEstado.PRESENTE;

    let asistencia = await prisma.asistencia.create({
      data: {
        colegioId:       req.colegioId!,
        estudianteId:    estudiante.id,
        aulaId:          aulaId ?? null,
        fecha:           new Date(hoy),
        estado,
        horaLlegada,
        registradoPorId: req.user!.id,
        escaneadoViaQR:  true,
      } as Prisma.AsistenciaUncheckedCreateInput,
    });

    // Notificar al padre principal
    const padrePrincipal = estudiante.padreEstudiantes[0]?.padre;
    if (padrePrincipal) {
      await enviarNotificacion({
        colegioId: req.colegioId!,
        padreId:   padrePrincipal.id,
        tipo:      'ASISTENCIA',
        titulo:    '✅ Asistencia registrada',
        cuerpo:    `${estudiante.nombres} ${estudiante.apellidos} llegó a las ${dayjs(horaLlegada).format('HH:mm')}`,
        datos:     { estudianteId: estudiante.id, ruta: '/padre/asistencia' },
        fcmToken:  padrePrincipal.usuario?.fcmToken ?? undefined,
      });
      asistencia = await prisma.asistencia.update({
        where: { id: asistencia.id },
        data: { notificadoPadre: true, notificadoEn: new Date() },
      });
    }

    res.status(201).json({ ok: true, data: asistencia, estudiante: {
      nombres:   estudiante.nombres,
      apellidos: estudiante.apellidos,
      fotoUrl:   estudiante.fotoUrl,
    }});
  },
);

// ─── GET /asistencia ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const {
    fecha, estudianteId, aulaId,
    page = '1', limit = '100',
  } = req.query as Record<string, string>;

  const where: any = { colegioId: req.colegioId };
  if (fecha)        where.fecha         = new Date(fecha);
  if (estudianteId) where.estudianteId  = estudianteId;
  if (aulaId)       where.aulaId        = aulaId;

  // Docentes solo ven su aula
  if (req.user!.rol === RolNombre.DOCENTE) {
    const aulasDocente = await prisma.docenteAula.findMany({
      where: { usuarioId: req.user!.id },
      select: { aulaId: true },
    });
    where.aulaId = { in: aulasDocente.map((a) => a.aulaId) };
  }

  // Padres SOLO pueden ver la asistencia de SUS hijos vinculados — antes
  // esta ruta no tenía ningún control para el rol PADRE (podía pedir la
  // asistencia de cualquier estudianteId del colegio).
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId } });
    const hijosIds = padre
      ? (await prisma.padreEstudiante.findMany({ where: { padreId: padre.id, estado: 'APROBADO' }, select: { estudianteId: true } })).map(pe => pe.estudianteId)
      : [];
    if (estudianteId && !hijosIds.includes(estudianteId)) throw new AppError('No tienes acceso a la asistencia de ese estudiante', 403);
    where.estudianteId = estudianteId ?? { in: hijosIds };
  }

  const [total, asistencias] = await Promise.all([
    prisma.asistencia.count({ where }),
    prisma.asistencia.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { fecha: 'desc' },
      include: {
        estudiante: { select: { nombres: true, apellidos: true, fotoUrl: true, dni: true } },
        registradoPor: { select: { nombres: true, apellidos: true } },
      },
    }),
  ]);

  res.json({ ok: true, data: asistencias, meta: { total } });
});

// ─── GET /asistencia/mis-aulas ────────────────────────────────────────────────
// Aulas donde el usuario actual puede tomar asistencia: Staff ve todas las
// del colegio; Docente/Auxiliar/Tutor/Coordinador solo las suyas (donde es
// tutor o donde tiene una materia asignada vía DocenteAula).
router.get('/mis-aulas', isDocente, async (req, res) => {
  const user = req.user!;
  const esStaff = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR, RolNombre.SECRETARIA] as string[]).includes(user.rol);
  const aulas = await prisma.aula.findMany({
    where: {
      colegioId: req.colegioId!, activo: true,
      ...(esStaff ? {} : { OR: [
        { docenteTutorId: user.id },
        { docentesAula: { some: { usuarioId: user.id, activo: true } } },
      ] }),
    },
    include: { seccion: { include: { nivelGrado: true } } },
    orderBy: { nombre: 'asc' },
  });
  res.json({ ok: true, data: aulas });
});

// ─── GET /asistencia/aula/:aulaId — lista de alumnos + su estado del día ─────
// A diferencia de GET /asistencia (que solo devuelve registros que YA
// existen), esto devuelve a TODOS los matriculados del aula, incluyendo los
// que todavía no tienen ningún registro ese día (para poder detectar quién
// no marcó por QR — ej. perdió su carnet — y marcarlo manualmente).
router.get('/aula/:aulaId', isDocente, async (req, res) => {
  const user = req.user!;
  const { fecha } = req.query as Record<string, string>;
  const fechaConsulta = fecha ? new Date(fecha) : new Date(dayjs().format('YYYY-MM-DD'));

  const aula = await prisma.aula.findFirst({ where: { id: req.params.aulaId, colegioId: req.colegioId! }, include: { seccion: true } });
  if (!aula) throw new AppError('Aula no encontrada', 404);

  const esStaff = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR, RolNombre.SECRETARIA] as string[]).includes(user.rol);
  if (!esStaff) {
    const tieneAcceso = aula.docenteTutorId === user.id || await prisma.docenteAula.findFirst({ where: { usuarioId: user.id, aulaId: aula.id, activo: true } });
    if (!tieneAcceso) throw new AppError('No tienes asignada esta aula', 403);
  }

  if (!aula.seccionId) return res.json({ ok: true, data: { aula, alumnos: [] } });

  const anoActual = new Date().getFullYear();
  const matriculas = await prisma.matricula.findMany({
    where: { seccionId: aula.seccionId, anoEscolar: anoActual, activa: true },
    include: { estudiante: { select: { id: true, nombres: true, apellidos: true, fotoUrl: true, dni: true, codigoQR: true } } },
    orderBy: { estudiante: { apellidos: 'asc' } },
  });

  const estudianteIds = matriculas.map(m => m.estudianteId);
  const asistencias = await prisma.asistencia.findMany({
    where: { colegioId: req.colegioId!, fecha: fechaConsulta, estudianteId: { in: estudianteIds } },
  });
  const porEstudiante = new Map(asistencias.map(a => [a.estudianteId, a]));

  const alumnos = matriculas.map(m => ({
    estudiante: m.estudiante,
    asistencia: porEstudiante.get(m.estudianteId) ?? null, // null = todavía no marcado
  }));

  res.json({ ok: true, data: { aula, fecha: fechaConsulta, alumnos } });
});

// ─── POST /asistencia/aula/:aulaId/marcar — marcar/corregir un alumno a mano ─
// Para cuando un alumno no pudo escanear su carnet (lo perdió, no llegó a
// leer bien el QR, etc.) — el docente/tutor de esa aula lo marca manualmente.
router.post(
  '/aula/:aulaId/marcar',
  isDocente,
  auditar({ modulo: 'ASISTENCIA', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const user = req.user!;
    const schema = z.object({
      estudianteId: z.string(),
      estado:       z.nativeEnum(AsistenciaEstado),
      fecha:        z.string().optional(),
    });
    const { estudianteId, estado, fecha } = schema.parse(req.body);
    const fechaRegistro = fecha ? new Date(fecha) : new Date(dayjs().format('YYYY-MM-DD'));

    const aula = await prisma.aula.findFirst({ where: { id: req.params.aulaId, colegioId: req.colegioId! } });
    if (!aula) throw new AppError('Aula no encontrada', 404);

    const esStaff = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR, RolNombre.SECRETARIA] as string[]).includes(user.rol);
    if (!esStaff) {
      const tieneAcceso = aula.docenteTutorId === user.id || await prisma.docenteAula.findFirst({ where: { usuarioId: user.id, aulaId: aula.id, activo: true } });
      if (!tieneAcceso) throw new AppError('No tienes asignada esta aula', 403);
    }

    // Confirma que el alumno de verdad pertenece a esta aula/sección — evita
    // que se pueda marcar asistencia de un estudiante de otra aula por error.
    const anoActual = new Date().getFullYear();
    const matricula = await prisma.matricula.findFirst({ where: { estudianteId, seccionId: aula.seccionId ?? undefined, anoEscolar: anoActual, activa: true } });
    if (!matricula) throw new AppError('El alumno no está matriculado en esta aula', 400);

    const existente = await prisma.asistencia.findFirst({ where: { colegioId: req.colegioId!, estudianteId, fecha: fechaRegistro } });
    const asistencia = existente
      ? await prisma.asistencia.update({ where: { id: existente.id }, data: { estado, aulaId: aula.id, escaneadoViaQR: false, registradoPorId: user.id } })
      : await prisma.asistencia.create({ data: {
          colegioId: req.colegioId!, estudianteId, aulaId: aula.id, fecha: fechaRegistro, estado,
          horaLlegada: estado === AsistenciaEstado.AUSENTE ? null : new Date(),
          registradoPorId: user.id, escaneadoViaQR: false,
        } as Prisma.AsistenciaUncheckedCreateInput });

    res.json({ ok: true, data: asistencia });
  },
);

// ─── PATCH /asistencia/:id ───────────────────────────────────────────────────
// Docente puede corregir o justificar, pero NO eliminar
router.patch(
  '/:id',
  isDocente,
  auditar({ modulo: 'ASISTENCIA', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: (r) => r.params.id }),
  async (req, res) => {
    const schema = z.object({
      estado:         z.nativeEnum(AsistenciaEstado).optional(),
      motivoAusencia: z.string().optional(),
      justificacion:  z.string().optional(),
    });
    const data = schema.parse(req.body);

    const asistencia = await prisma.asistencia.findFirst({
      where: { id: req.params.id, colegioId: req.colegioId! },
    });
    if (!asistencia) throw new AppError('Registro de asistencia no encontrado', 404);

    const updated = await prisma.asistencia.update({
      where: { id: req.params.id },
      data: {
        ...data,
        justificadoPorId: data.justificacion ? req.user!.id : undefined,
      },
    });
    res.json({ ok: true, data: updated });
  },
);

// ─── GET /asistencia/resumen/:estudianteId ───────────────────────────────────
router.get('/resumen/:estudianteId', async (req, res) => {
  const { mes, año = new Date().getFullYear().toString() } = req.query as Record<string, string>;

  const where: any = { colegioId: req.colegioId!, estudianteId: req.params.estudianteId };

  if (mes) {
    const inicio = new Date(`${año}-${mes.padStart(2, '0')}-01`);
    const fin    = dayjs(inicio).endOf('month').toDate();
    where.fecha  = { gte: inicio, lte: fin };
  }

  const asistencias = await prisma.asistencia.findMany({ where, orderBy: { fecha: 'asc' } });

  const resumen = {
    total:       asistencias.length,
    presentes:   asistencias.filter((a) => a.estado === 'PRESENTE').length,
    ausentes:    asistencias.filter((a) => a.estado === 'AUSENTE').length,
    tardanzas:   asistencias.filter((a) => a.estado === 'TARDANZA').length,
    justificados: asistencias.filter((a) => a.estado === 'JUSTIFICADO').length,
    permisos:    asistencias.filter((a) => a.estado === 'PERMISO').length,
    detalle:     asistencias,
  };

  res.json({ ok: true, data: resumen });
});

export default router;
