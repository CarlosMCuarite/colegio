// src/routes/dashboard.ts
import { Router } from 'express';
import prisma from '../config/prisma';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { AppError } from '../utils/AppError';
import { RolNombre } from '@prisma/client';
import dayjs from 'dayjs';

const router = Router();
router.use(authenticate, resolveTenant);

router.get('/ejecutivo', async (req, res) => {
  const user = req.user!;
  if (!([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR, RolNombre.SECRETARIA] as string[]).includes(user.rol))
    throw new AppError('Sin acceso', 403);
  const colegioId = req.colegioId ?? user.colegioId;
  if (!colegioId) throw new AppError('Sin colegio especificado', 400);

  const hoy = dayjs().startOf('day').toDate();
  const inicioMes = dayjs().startOf('month').toDate();
  const finMes = dayjs().endOf('month').toDate();
  const ano = new Date().getFullYear();

  const [
    totalEstudiantes, estudiantesPorEstado, asistenciaHoy, matriculasAno,
    pagosMes, pagosMorosidad, colegio, usuariosActivos, asistencia7dias,
    eventosProximos, comunicadosRecientes, documentosPendientes, permisosPendientes,
    totalDocentes, totalPadres,
  ] = await Promise.all([
    prisma.estudiante.count({ where: { colegioId, estado: 'ACTIVO', deletedAt: null } }),
    prisma.estudiante.groupBy({ by: ['estado'], where: { colegioId, deletedAt: null }, _count: true }),
    prisma.asistencia.groupBy({ by: ['estado'], where: { colegioId, fecha: hoy }, _count: true }),
    prisma.matricula.count({ where: { colegioId, anoEscolar: ano, activa: true } }),
    prisma.pago.aggregate({ where: { colegioId, estado: 'APROBADO', fechaAprobacion: { gte: inicioMes, lte: finMes } }, _sum: { monto: true }, _count: true }),
    prisma.pago.aggregate({ where: { colegioId, estado: { in: ['PENDIENTE','EN_REVISION'] } }, _sum: { monto: true }, _count: true }),
    prisma.colegio.findUnique({ where: { id: colegioId }, select: { nombre: true, logoUrl: true, estado: true, almacenamientoUsadoMB: true, licenciaFin: true, plan: { select: { maxAlmacenamientoGB: true, maxEstudiantes: true, nombre: true } } } }),
    prisma.usuario.count({ where: { colegioId, activo: true } }),
    (prisma.$queryRawUnsafe(`SELECT fecha::text, COUNT(*) FILTER (WHERE estado = 'PRESENTE') AS presente, COUNT(*) FILTER (WHERE estado = 'AUSENTE') AS ausente, COUNT(*) FILTER (WHERE estado = 'TARDANZA') AS tardanza FROM asistencias WHERE "colegioId" = $1 AND fecha >= $2 GROUP BY fecha ORDER BY fecha ASC`, colegioId, dayjs().subtract(6,'day').startOf('day').toDate()) as Promise<Array<{ fecha: string; presente: bigint; ausente: bigint; tardanza: bigint }>>),
    prisma.evento.findMany({ where: { colegioId, activo: true, fechaInicio: { gte: new Date() } }, orderBy: { fechaInicio: 'asc' }, take: 5 }),
    prisma.comunicado.findMany({ where: { colegioId, activo: true }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, titulo: true, createdAt: true } }),
    prisma.documento.count({ where: { colegioId, estado: 'PENDIENTE' } }),
    prisma.permisoSalida.count({ where: { colegioId, estado: 'SOLICITADO' } }),
    prisma.usuario.count({ where: { colegioId, activo: true, rol: { in: ['DOCENTE','AUXILIAR','TUTOR','COORDINADOR'] } } }),
    prisma.padre.count({ where: { colegioId, activo: true } }),
  ]);

  const diasLicencia = colegio?.licenciaFin ? Math.ceil((colegio.licenciaFin.getTime() - Date.now()) / 86400000) : null;

  res.json({
    ok: true,
    data: {
      colegio: { nombre: colegio?.nombre, logoUrl: colegio?.logoUrl, estado: colegio?.estado, planNombre: colegio?.plan?.nombre },
      kpis: { totalEstudiantes, totalDocentes, totalPadres, matriculasAno, usuariosActivos, documentosPendientes, permisosPendientes },
      estudiantes: { porEstado: estudiantesPorEstado },
      asistencia: {
        hoy: asistenciaHoy,
        semana: asistencia7dias.map(r => ({ fecha: dayjs(r.fecha).format('DD/MM'), presente: Number(r.presente), ausente: Number(r.ausente), tardanza: Number(r.tardanza) })),
      },
      finanzas: {
        ingresosMes: { total: pagosMes._count, monto: Number(pagosMes._sum.monto ?? 0) },
        pendientesCobrar: { total: pagosMorosidad._count, monto: Number(pagosMorosidad._sum.monto ?? 0) },
      },
      almacenamiento: {
        usadoMB: colegio?.almacenamientoUsadoMB ?? 0, maxGB: colegio?.plan.maxAlmacenamientoGB ?? 0,
        porcentaje: colegio ? Math.round((colegio.almacenamientoUsadoMB / ((colegio.plan.maxAlmacenamientoGB ?? 1)*1024))*100) : 0,
      },
      licencia: { diasRestantes: diasLicencia, alerta: diasLicencia !== null && diasLicencia <= 30 },
      eventosProximos, comunicadosRecientes,
    },
  });
});

router.get('/padre', async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.PADRE) throw new AppError('Acceso exclusivo para padres', 403);
  const colegioId = user.colegioId;
  if (!colegioId) throw new AppError('Sin colegio', 400);

  const padre = await prisma.padre.findFirst({
    where: { usuarioId: user.id, colegioId },
    include: { padreEstudiantes: { where: { estado: 'APROBADO' }, include: { estudiante: { include: { matriculas: { where: { activa: true }, include: { nivelGrado: true, seccion: true }, take: 1 } } } } } },
  });
  if (!padre) throw new AppError('Perfil de padre no encontrado', 404);

  const estudianteIds = padre.padreEstudiantes.map(pe => pe.estudianteId);
  const hoy = dayjs().startOf('day').toDate();
  const inicioMes = dayjs().startOf('month').toDate();

  const [asistenciaHoy, asistenciaMes, pagosPendientes, comunicados, eventos, observaciones, notificaciones, horarios] = await Promise.all([
    prisma.asistencia.findMany({ where: { estudianteId: { in: estudianteIds }, fecha: hoy }, include: { estudiante: { select: { nombres: true, id: true } } } }),
    prisma.asistencia.groupBy({ by: ['estado','estudianteId'], where: { estudianteId: { in: estudianteIds }, fecha: { gte: inicioMes } }, _count: true }),
    prisma.pago.findMany({ where: { padreId: padre.id, estado: { in: ['PENDIENTE','EN_REVISION'] } }, include: { concepto: { select: { nombre: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.comunicado.findMany({ where: { colegioId, activo: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.evento.findMany({ where: { colegioId, activo: true, fechaInicio: { gte: new Date() } }, orderBy: { fechaInicio: 'asc' }, take: 5 }),
    prisma.observacion.findMany({ where: { estudianteId: { in: estudianteIds } }, orderBy: { fecha: 'desc' }, take: 5, include: { creadoPor: { select: { nombres: true, apellidos: true } } } }),
    prisma.notificacion.findMany({ where: { padreId: padre.id, leida: false }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.horario.findMany({ where: { colegioId, nivelGradoId: { in: padre.padreEstudiantes.map(pe => pe.estudiante.matriculas[0]?.nivelGradoId).filter(Boolean) as string[] }, activo: true }, orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }] }),
  ]);

  res.json({
    ok: true,
    data: {
      padre: { id: padre.id, nombres: padre.nombres, apellidos: padre.apellidos },
      estudiantes: padre.padreEstudiantes.map(pe => pe.estudiante),
      asistenciaHoy, asistenciaMes, pagosPendientes,
      totalDeuda: pagosPendientes.reduce((s, p) => s + Number(p.monto), 0),
      comunicados, eventos, observaciones, notificaciones,
      totalNotifNoLeidas: notificaciones.length, horarios,
    },
  });
});

// Bandeja común para todos los roles. Conserva también las leídas recientes
// para que abrir la campana no haga desaparecer el historial.
router.get('/notificaciones', async (req, res) => {
  const user = req.user!;
  let where: any = { usuarioId: user.id };
  if (user.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: user.id }, select: { id: true } });
    where = padre ? { padreId: padre.id } : { id: '__sin_perfil_padre__' };
  }
  const notificaciones = await prisma.notificacion.findMany({ where, orderBy: { createdAt: 'desc' }, take: 30 });
  res.json({ ok: true, data: { notificaciones, totalNoLeidas: notificaciones.filter(n => !n.leida).length } });
});

router.patch('/notificaciones/:id/leer', async (req, res) => {
  const user = req.user!;
  let where: any = { id: req.params.id, usuarioId: user.id };
  if (user.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: user.id }, select: { id: true } });
    where = { id: req.params.id, padreId: padre?.id ?? '__sin_perfil_padre__' };
  }
  const actualizada = await prisma.notificacion.updateMany({ where, data: { leida: true } });
  if (!actualizada.count) throw new AppError('Notificación no encontrada', 404);
  res.json({ ok: true });
});

router.post('/notificaciones/leer', async (req, res) => {
  const user = req.user!;
  if (user.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: user.id } });
    if (padre) await prisma.notificacion.updateMany({ where: { padreId: padre.id, leida: false }, data: { leida: true } });
  } else {
    await prisma.notificacion.updateMany({ where: { usuarioId: user.id, leida: false }, data: { leida: true } });
  }
  res.json({ ok: true });
});

router.get('/superadmin', async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);
  const ano = new Date().getFullYear();
  const hoy = new Date();
  const en30dias = new Date(hoy.getTime() + 30 * 86400000);

  const [
    totalColegios, colegiosPorEstado, totalEstudiantes, totalPadres, totalDocentes,
    totalUsuarios, totalMatriculas,
    colegiosPorVencer, colegiosVencidos,
    ingresosSuscripcionTotal, pagosLicenciaPendientes, backupsFallidosRecientes,
    ultimaAuditoria, usuariosPorRol, matriculasPorMes, asistenciaGlobal,
    ingresosPorMes, colegiosConPlan,
  ] = await Promise.all([
    prisma.colegio.count(),
    prisma.colegio.groupBy({ by: ['estado'], _count: true }),
    prisma.estudiante.count({ where: { deletedAt: null, estado: 'ACTIVO' } }),
    prisma.padre.count({ where: { deletedAt: null, activo: true } }),
    prisma.usuario.count({ where: { activo: true, rol: { in: ['DOCENTE','AUXILIAR','TUTOR','COORDINADOR'] } } }),
    prisma.usuario.count({ where: { activo: true } }),
    prisma.matricula.count({ where: { anoEscolar: ano, activa: true } }),
    prisma.colegio.findMany({ where: { estado: { in: ['ACTIVO','PRUEBA'] }, licenciaFin: { lte: en30dias, gte: hoy } }, include: { plan: { select: { nombre: true } } }, orderBy: { licenciaFin: 'asc' } }),
    prisma.colegio.findMany({ where: { estado: { in: ['ACTIVO','PRUEBA'] }, licenciaFin: { lt: hoy } }, include: { plan: { select: { nombre: true } } }, orderBy: { licenciaFin: 'asc' }, take: 10 }),
    prisma.pagoLicencia.aggregate({ where: { estado: 'APROBADO' }, _sum: { monto: true } }),
    prisma.pagoLicencia.count({ where: { estado: 'EN_REVISION' } }),
    prisma.backup.count({ where: { estado: 'FALLIDO', createdAt: { gte: new Date(hoy.getTime() - 24 * 3600000) } } }),
    prisma.auditoria.findMany({ orderBy: { createdAt: 'desc' }, take: 15, include: { colegio: { select: { nombre: true } }, usuario: { select: { nombres: true, rol: true } } } }),
    prisma.usuario.groupBy({ by: ['rol'], where: { activo: true }, _count: true }),
    (prisma.$queryRawUnsafe(`SELECT TO_CHAR("fechaMatricula", 'MM/YYYY') AS mes, COUNT(*)::int AS total FROM matriculas WHERE "anoEscolar" = $1 AND "activa" = true AND "fechaMatricula" >= NOW() - INTERVAL '6 months' GROUP BY TO_CHAR("fechaMatricula", 'MM/YYYY') ORDER BY MIN("fechaMatricula") ASC`, ano) as Promise<Array<{ mes: string; total: number }>>),
    prisma.asistencia.groupBy({ by: ['estado'], where: { fecha: dayjs().startOf('day').toDate() }, _count: true }),
    (prisma.$queryRawUnsafe(`SELECT TO_CHAR("createdAt", 'MM/YYYY') AS mes, SUM("monto")::float AS total FROM pagos_licencia WHERE "estado" = 'APROBADO' AND "createdAt" >= NOW() - INTERVAL '12 months' GROUP BY TO_CHAR("createdAt", 'MM/YYYY') ORDER BY MIN("createdAt") ASC`) as Promise<Array<{ mes: string; total: number }>>),
    prisma.colegio.findMany({ where: { estado: { in: ['ACTIVO','PRUEBA'] } }, include: { plan: { select: { precio: true, duracionDias: true } } } }),
  ]);

  const conteoPorEstado = (estado: string) =>
    colegiosPorEstado.find(c => c.estado === estado)?._count ?? 0;

  // MRR: normaliza el precio del plan de cada colegio activo a "por mes"
  // según la duración de su plan (si es anual, se divide entre 12, etc.).
  const mrr = colegiosConPlan.reduce((sum, c) => {
    const precio = Number(c.plan?.precio ?? 0);
    const dias = c.plan?.duracionDias ?? 30;
    return sum + (precio / dias) * 30;
  }, 0);

  res.json({
    ok: true,
    data: {
      kpis: {
        totalColegios,
        colegiosActivos:     conteoPorEstado('ACTIVO'),
        colegiosSuspendidos: conteoPorEstado('SUSPENDIDO'),
        colegiosEnPrueba:    conteoPorEstado('PRUEBA'),
        totalEstudiantes, totalPadres, totalDocentes, totalUsuarios, totalMatriculas,
        licenciasActivas:   conteoPorEstado('ACTIVO') + conteoPorEstado('PRUEBA'),
        licenciasPorVencer: colegiosPorVencer.length,
        licenciasVencidas:  colegiosVencidos.length,
        ingresosSuscripcion: Number(ingresosSuscripcionTotal._sum.monto ?? 0),
        mrr: Math.round(mrr * 100) / 100,
      },
      alertas: {
        colegiosPorVencer, colegiosVencidos,
        pagosPendientesRevision: pagosLicenciaPendientes,
        backupsFallidos24h: backupsFallidosRecientes,
      },
      colegiosPorEstado, ultimaAuditoria,
      graficos: {
        usuariosPorRol: usuariosPorRol.map(r => ({ rol: r.rol, total: r._count })),
        matriculasPorMes, asistenciaGlobal, ingresosPorMes,
      },
    },
  });
});

// ─── GET /dashboard/monitoreo — Salud del sistema (SuperAdmin) ───────────────
// No hay un servicio externo de monitoreo (uptime, APM, etc.) — esto arma
// una vista de salud a partir de lo que el propio backend puede medir:
// latencia real a la base de datos, memoria/uptime del proceso, tasa de
// éxito de los backups automáticos, y actividad reciente de usuarios.
router.get('/monitoreo', async (req, res) => {
  if (req.user!.rol !== RolNombre.SUPERADMIN) throw new AppError('Sin acceso', 403);

  const hace24h = new Date(Date.now() - 24 * 3600000);
  const hace7d  = new Date(Date.now() - 7 * 24 * 3600000);
  const hace1h  = new Date(Date.now() - 3600000);
  const hace15min = new Date(Date.now() - 15 * 60000);

  const inicioDb = Date.now();
  let dbOk = true;
  try { await prisma.$queryRawUnsafe('SELECT 1'); } catch { dbOk = false; }
  const dbLatenciaMs = Date.now() - inicioDb;

  const [
    backups24h, backups7d, backupsFallidosRecientes,
    usuariosActivos15min, usuariosActivos1h,
    ultimosAccesos, coleigiosSuspendidos, erroresAuditoriaRecientes,
    databaseSizeRows, almacenamientoRegistrado,
  ] = await Promise.all([
    prisma.backup.groupBy({ by: ['estado'], where: { createdAt: { gte: hace24h } }, _count: true }),
    prisma.backup.groupBy({ by: ['estado'], where: { createdAt: { gte: hace7d } }, _count: true }),
    prisma.backup.findMany({ where: { estado: 'FALLIDO', createdAt: { gte: hace24h } }, include: { colegio: { select: { nombre: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.usuario.count({ where: { ultimoLogin: { gte: hace15min } } }),
    prisma.usuario.count({ where: { ultimoLogin: { gte: hace1h } } }),
    prisma.usuario.findMany({
      where: { ultimoLogin: { not: null }, activo: true },
      orderBy: { ultimoLogin: 'desc' },
      take: 12,
      select: {
        id: true, nombres: true, apellidos: true, email: true, rol: true,
        avatarUrl: true, ultimoLogin: true,
        colegio: { select: { nombre: true } },
      },
    }),
    prisma.colegio.count({ where: { estado: 'SUSPENDIDO' } }),
    prisma.auditoria.findMany({ orderBy: { createdAt: 'desc' }, take: 25, include: { colegio: { select: { nombre: true } }, usuario: { select: { nombres: true, apellidos: true, rol: true } } } }),
    prisma.$queryRawUnsafe<Array<{ bytes: bigint }>>('SELECT pg_database_size(current_database()) AS bytes'),
    prisma.colegio.aggregate({ _sum: { almacenamientoUsadoMB: true } }),
  ]);

  const contarEstado = (arr: any[], estado: string) => arr.find(x => x.estado === estado)?._count ?? 0;
  const totalBackups24h = backups24h.reduce((s, b) => s + b._count, 0);
  const okBackups24h    = contarEstado(backups24h, 'COMPLETADO');
  const totalBackups7d  = backups7d.reduce((s, b) => s + b._count, 0);
  const okBackups7d     = contarEstado(backups7d, 'COMPLETADO');

  const mem = process.memoryUsage();
  const databaseBytes = Number(databaseSizeRows[0]?.bytes ?? 0);
  const databaseLimitBytes = 500 * 1024 * 1024;
  const storageUsedMB = Number(almacenamientoRegistrado._sum.almacenamientoUsadoMB ?? 0);
  const storageLimitMB = 1024;

  res.json({
    ok: true,
    data: {
      baseDatos: {
        ok: dbOk, latenciaMs: dbLatenciaMs,
        usadoMB: Math.round((databaseBytes / 1024 / 1024) * 100) / 100,
        limiteMB: 500,
        porcentaje: Math.min(100, Math.round((databaseBytes / databaseLimitBytes) * 100)),
      },
      almacenamiento: {
        usadoMB: Math.round(storageUsedMB * 100) / 100,
        limiteMB: storageLimitMB,
        porcentaje: Math.min(100, Math.round((storageUsedMB / storageLimitMB) * 100)),
        alcance: 'Archivos registrados por SIGE',
      },
      servidor: {
        uptimeSegundos: Math.round(process.uptime()),
        memoriaUsadaMB: Math.round(mem.heapUsed / 1024 / 1024),
        memoriaTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        nodeVersion: process.version,
      },
      backups: {
        ultimas24h: { total: totalBackups24h, exitosos: okBackups24h, fallidos: contarEstado(backups24h, 'FALLIDO'), tasaExito: totalBackups24h ? Math.round((okBackups24h / totalBackups24h) * 100) : null },
        ultimos7d:  { total: totalBackups7d, exitosos: okBackups7d, fallidos: contarEstado(backups7d, 'FALLIDO'), tasaExito: totalBackups7d ? Math.round((okBackups7d / totalBackups7d) * 100) : null },
        fallosRecientes: backupsFallidosRecientes,
      },
      usuarios: { activosUltimos15min: usuariosActivos15min, activosUltimaHora: usuariosActivos1h, ultimosAccesos },
      colegiosSuspendidos: coleigiosSuspendidos,
      actividadReciente: erroresAuditoriaRecientes,
    },
  });
});

export default router;
