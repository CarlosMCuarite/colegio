// src/routes/reportes.ts
// Reportes a nivel colegio — pensado para Director/Admin. El diferenciador
// es "Alumnos en riesgo": cruza asistencia + notas + pagos en un solo
// reporte, en vez de tener que revisar 3 módulos por separado para
// encontrar a los mismos alumnos que necesitan atención.
import { Router } from 'express';
import prisma from '../config/prisma';
import { authenticate, isAdminDir } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { NOTA_APROBATORIA_NUMERICA } from '../utils/calificaciones';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant, isAdminDir);

// ── GET /reportes/resumen — números generales del colegio ─────────────────────
router.get('/resumen', async (req, res) => {
  const colegioId = req.colegioId!;
  const anoActual = new Date().getFullYear();
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [totalEstudiantes, asistenciasMes, notasRecientes, pagosMes, pagosAprobadosMes] = await Promise.all([
    prisma.matricula.count({ where: { colegioId, activa: true, anoEscolar: anoActual } }),
    prisma.asistencia.findMany({ where: { colegioId, fecha: { gte: inicioMes } }, select: { estado: true } }),
    prisma.nota.findMany({ where: { colegioId, createdAt: { gte: new Date(anoActual, 0, 1) } }, select: { calificacionNumerica: true } }),
    prisma.pago.count({ where: { colegioId, createdAt: { gte: inicioMes } } }),
    prisma.pago.count({ where: { colegioId, estado: 'APROBADO', createdAt: { gte: inicioMes } } }),
  ]);

  const totalAsist = asistenciasMes.length;
  const presentes = asistenciasMes.filter(a => a.estado === 'PRESENTE' || a.estado === 'TARDANZA').length;
  const numeros = notasRecientes.filter(n => n.calificacionNumerica != null).map(n => Number(n.calificacionNumerica)).filter(x => !isNaN(x));

  res.json({
    ok: true,
    data: {
      totalEstudiantes,
      asistenciaPromedioPct: totalAsist ? Math.round((presentes / totalAsist) * 1000) / 10 : null,
      notaPromedioGeneral: numeros.length ? Math.round((numeros.reduce((a, b) => a + b, 0) / numeros.length) * 100) / 100 : null,
      pagosMes, pagosAprobadosMes,
      pagosPendientesMes: pagosMes - pagosAprobadosMes,
    },
  });
});

// ── GET /reportes/alumnos-riesgo — cruce asistencia + notas + pagos ───────────
router.get('/alumnos-riesgo', async (req, res) => {
  const colegioId = req.colegioId!;
  const anoActual = new Date().getFullYear();
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const matriculas = await prisma.matricula.findMany({
    where: { colegioId, activa: true, anoEscolar: anoActual },
    include: {
      estudiante: { select: { id: true, nombres: true, apellidos: true, fotoUrl: true } },
      nivelGrado: { select: { nombre: true } },
      seccion: { select: { nombre: true } },
    },
  });

  const resultado = [];
  for (const m of matriculas) {
    const [asistenciaMes, notas, pagoAprobadoMes] = await Promise.all([
      prisma.asistencia.findMany({ where: { estudianteId: m.estudianteId, fecha: { gte: inicioMes } }, select: { estado: true } }),
      prisma.nota.findMany({ where: { estudianteId: m.estudianteId }, select: { calificacionNumerica: true }, orderBy: { createdAt: 'desc' }, take: 12 }),
      prisma.pago.findFirst({ where: { estudianteId: m.estudianteId, estado: 'APROBADO', createdAt: { gte: inicioMes } } }),
    ]);

    const totalAsist = asistenciaMes.length;
    const ausencias = asistenciaMes.filter(a => a.estado === 'AUSENTE').length;
    const pctAusencia = totalAsist ? (ausencias / totalAsist) * 100 : 0;
    const numeros = notas.filter(n => n.calificacionNumerica != null).map(n => Number(n.calificacionNumerica)).filter(x => !isNaN(x));
    const promedioNotas = numeros.length ? numeros.reduce((a, b) => a + b, 0) / numeros.length : null;

    const factores: string[] = [];
    if (totalAsist >= 4 && pctAusencia >= 20) factores.push('Inasistencias frecuentes');
    if (promedioNotas != null && promedioNotas < NOTA_APROBATORIA_NUMERICA) factores.push('Notas bajo el mínimo');
    if (!pagoAprobadoMes) factores.push('Sin pago aprobado este mes');

    if (factores.length > 0) {
      resultado.push({
        estudiante: m.estudiante,
        grado: m.nivelGrado.nombre, seccion: m.seccion?.nombre,
        pctAusencia: Math.round(pctAusencia * 10) / 10,
        promedioNotas: promedioNotas != null ? Math.round(promedioNotas * 100) / 100 : null,
        factores,
      });
    }
  }

  resultado.sort((a, b) => b.factores.length - a.factores.length);
  res.json({ ok: true, data: resultado });
});

export default router;
