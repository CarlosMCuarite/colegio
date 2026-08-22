// src/routes/notas.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isDocente } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, RolNombre, CalificacionLiteral } from '@prisma/client';
import { literalesValidasParaNivel, usaNumeroDirecto, literalAEquivalenteNumerico, numeroABanda } from '../utils/calificaciones';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const notaInputSchema = z.object({
  estudianteId: z.string(),
  cursoId:      z.string(),
  periodo:      z.enum(['BIMESTRE_1', 'BIMESTRE_2', 'BIMESTRE_3', 'BIMESTRE_4']),
  calificacionLiteral: z.nativeEnum(CalificacionLiteral).optional().nullable(),
  calificacionNumerica: z.number().min(0).max(20).optional().nullable(),
  observacion: z.string().max(300).optional().nullable(),
});

// Verifica que el docente logueado de verdad dicte este curso en el aula del
// estudiante — el mismo criterio de origen que ya usamos para Comunicados:
// el backend valida, no solo el frontend, quién puede tocar qué.
async function verificarPermisoDocente(colegioId: string, usuarioId: string, cursoId: string, estudianteId: string) {
  const anoActual = new Date().getFullYear();
  const matricula = await prisma.matricula.findFirst({
    where: { estudianteId, activa: true, anoEscolar: anoActual },
    select: { seccionId: true },
  });
  if (!matricula?.seccionId) throw new AppError('El estudiante no tiene matrícula activa este año', 400);

  const asignado = await prisma.docenteAula.findFirst({
    where: { usuarioId, cursoId, activo: true, aula: { seccionId: matricula.seccionId } },
  });
  if (!asignado) throw new AppError('No tienes asignado ese curso para ese estudiante', 403);
}

// ── GET /notas — notas de un estudiante (padre/staff) o de un curso+aula (docente) ─
router.get('/', async (req, res) => {
  const { estudianteId, cursoId, aulaId, periodo } = req.query as Record<string, string>;
  const where: any = { colegioId: req.colegioId! };
  if (cursoId) where.cursoId = cursoId;
  if (periodo) where.periodo = periodo;

  // BUG DE SEGURIDAD REAL encontrado: esta ruta no verificaba nada para
  // roles que no fueran Padre — cualquier usuario autenticado (incluyendo
  // un Docente que no dicta ese curso) podía pedir las notas de CUALQUIER
  // aula o estudiante del colegio pasando el id directamente, sin que
  // hubiera ningún candado de por medio. Se corrige con el mismo criterio
  // que ya se usa en Asistencia/Comunicados: Staff y los roles que por
  // diseño ven todo el colegio (Psicólogo/Enfermería/Auxiliar) pasan sin
  // restricción; Docente/Tutor/Coordinador deben tener asignado ese curso
  // específico.
  const STAFF_Y_COLEGIO_ENTERO: string[] = [
    RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR, RolNombre.SECRETARIA,
    RolNombre.PSICOLOGO, RolNombre.ENFERMERIA, RolNombre.AUXILIAR,
  ];

  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId! } });
    const hijosIds = padre
      ? (await prisma.padreEstudiante.findMany({ where: { padreId: padre.id, estado: 'APROBADO' }, select: { estudianteId: true } })).map(pe => pe.estudianteId)
      : [];
    if (estudianteId && !hijosIds.includes(estudianteId)) throw new AppError('No tienes acceso a las notas de ese estudiante', 403);
    where.estudianteId = estudianteId ?? { in: hijosIds };
  } else if (estudianteId) {
    if (!STAFF_Y_COLEGIO_ENTERO.includes(req.user!.rol)) {
      if (!cursoId) throw new AppError('Indica el curso', 400);
      await verificarPermisoDocente(req.colegioId!, req.user!.id, cursoId, estudianteId);
    }
    where.estudianteId = estudianteId;
  } else if (aulaId && cursoId) {
    if (!STAFF_Y_COLEGIO_ENTERO.includes(req.user!.rol)) {
      const asignado = await prisma.docenteAula.findFirst({ where: { usuarioId: req.user!.id, aulaId, cursoId, activo: true } });
      if (!asignado) throw new AppError('No tienes asignado ese curso en esa aula', 403);
    }
    const aula = await prisma.aula.findFirst({ where: { id: aulaId, colegioId: req.colegioId! }, select: { seccionId: true } });
    const matriculas = await prisma.matricula.findMany({
      where: { activa: true, anoEscolar: new Date().getFullYear(), seccionId: aula?.seccionId ?? '__ninguna__' },
      select: { estudianteId: true },
    });
    where.estudianteId = { in: matriculas.map(m => m.estudianteId) };
  } else {
    throw new AppError('Indica estudianteId, o aulaId + cursoId', 400);
  }

  const notas = await prisma.nota.findMany({
    where,
    include: {
      curso: { select: { id: true, nombre: true, areaCurricular: true, nivelGrado: { select: { nivel: true } } } },
      estudiante: { select: { id: true, nombres: true, apellidos: true, fotoUrl: true } },
    },
    orderBy: [{ periodo: 'asc' }],
  });
  res.json({ ok: true, data: notas });
});

// ── GET /notas/roster/:aulaId/:cursoId/:periodo — roster + notas para que el ──
// docente pueda registrar. Devuelve TODOS los alumnos del aula, tengan o no
// nota ya puesta (así el formulario los muestra a todos de una vez).
router.get('/roster/:aulaId/:cursoId/:periodo', isDocente, async (req, res) => {
  const { aulaId, cursoId, periodo } = req.params;
  const esStaff = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR] as string[]).includes(req.user!.rol);
  if (!esStaff) {
    const asignado = await prisma.docenteAula.findFirst({ where: { usuarioId: req.user!.id, aulaId, cursoId, activo: true } });
    if (!asignado) throw new AppError('No tienes asignado ese curso en esa aula', 403);
  }

  const aula = await prisma.aula.findFirst({ where: { id: aulaId, colegioId: req.colegioId! }, include: { seccion: { include: { nivelGrado: true } } } });
  if (!aula?.seccion) throw new AppError('Aula no encontrada', 404);

  const anoActual = new Date().getFullYear();
  const matriculas = await prisma.matricula.findMany({
    where: { activa: true, anoEscolar: anoActual, seccionId: aula.seccionId! },
    include: { estudiante: { select: { id: true, nombres: true, apellidos: true, dni: true, fotoUrl: true } } },
    orderBy: { estudiante: { apellidos: 'asc' } },
  });

  const notasExistentes = await prisma.nota.findMany({
    where: { cursoId, periodo: periodo as any, estudianteId: { in: matriculas.map(m => m.estudianteId) } },
  });
  const porEstudiante = new Map(notasExistentes.map(n => [n.estudianteId, n]));

  res.json({
    ok: true,
    nivel: aula.seccion.nivelGrado.nivel,
    usaNumero: usaNumeroDirecto(aula.seccion.nivelGrado.nivel),
    literalesValidas: literalesValidasParaNivel(aula.seccion.nivelGrado.nivel),
    data: matriculas.map(m => ({
      estudiante: m.estudiante,
      nota: porEstudiante.get(m.estudianteId) ?? null,
    })),
  });
});

// ── POST /notas/bulk — el docente guarda TODA la lista de un curso+periodo de una vez ─
router.post('/bulk', isDocente, auditar({ modulo: 'NOTAS', accion: AuditoriaAccion.CREAR }), async (req, res) => {
  const { notas } = z.object({ notas: z.array(notaInputSchema).min(1).max(80) }).parse(req.body);
  const esStaff = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR] as string[]).includes(req.user!.rol);

  const resultado = [];
  for (const n of notas) {
    if (!esStaff) await verificarPermisoDocente(req.colegioId!, req.user!.id, n.cursoId, n.estudianteId);

    // BUG REAL encontrado: no se validaba que la letra enviada fuera válida
    // para el nivel del curso — un Inicial no debería poder recibir "AD"
    // (ese nivel solo usa A/B/C), pero el backend lo aceptaba igual porque
    // solo se validaba que fuera "una letra del enum", no cuál letra según
    // el nivel. El frontend ya no lo dejaba elegir, pero el backend debe
    // validarlo también — no hay que confiar solo en el frontend.
    if (n.calificacionLiteral) {
      const curso = await prisma.curso.findUnique({ where: { id: n.cursoId }, select: { nivelGrado: { select: { nivel: true } } } });
      if (curso && !literalesValidasParaNivel(curso.nivelGrado.nivel).includes(n.calificacionLiteral)) {
        throw new AppError(`La calificación "${n.calificacionLiteral}" no es válida para ${curso.nivelGrado.nivel}`, 400);
      }
    }

    // Se completa automáticamente el valor que falte (literal ↔ numérico),
    // para que SIEMPRE quede un número guardado (necesario para promediar)
    // sin importar si el docente calificó con letra o con número.
    let literal = n.calificacionLiteral ?? null;
    let numerica = n.calificacionNumerica ?? null;
    if (literal && numerica == null) numerica = literalAEquivalenteNumerico(literal);
    if (numerica != null && !literal) literal = numeroABanda(numerica).literal;
    if (literal == null && numerica == null) throw new AppError('Falta la calificación (letra o número) de un estudiante', 400);

    const nota = await prisma.nota.upsert({
      where: { estudianteId_cursoId_periodo: { estudianteId: n.estudianteId, cursoId: n.cursoId, periodo: n.periodo } },
      create: {
        colegioId: req.colegioId!, estudianteId: n.estudianteId, cursoId: n.cursoId, periodo: n.periodo,
        calificacionLiteral: literal, calificacionNumerica: numerica, observacion: n.observacion ?? null,
        registradoPorId: req.user!.id,
      },
      update: {
        calificacionLiteral: literal, calificacionNumerica: numerica, observacion: n.observacion ?? null,
        registradoPorId: req.user!.id,
      },
    });
    resultado.push(nota);
  }
  res.status(201).json({ ok: true, data: resultado });
});

// ── GET /notas/boletin/:estudianteId — todas las notas agrupadas por curso ────
router.get('/boletin/:estudianteId', async (req, res) => {
  const { estudianteId } = req.params;

  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId! } });
    const esHijo = padre && await prisma.padreEstudiante.findFirst({ where: { padreId: padre.id, estudianteId, estado: 'APROBADO' } });
    if (!esHijo) throw new AppError('No tienes acceso al boletín de ese estudiante', 403);
  }

  const anoActual = new Date().getFullYear();
  const estudiante = await prisma.estudiante.findFirst({
    where: { id: estudianteId, colegioId: req.colegioId! },
    include: {
      matriculas: { where: { activa: true, anoEscolar: anoActual }, include: { nivelGrado: true, seccion: true }, take: 1 },
    },
  });
  if (!estudiante) throw new AppError('Estudiante no encontrado', 404);
  const matricula = estudiante.matriculas[0];
  if (!matricula) throw new AppError('El estudiante no tiene matrícula activa este año', 400);

  const cursos = await prisma.curso.findMany({ where: { colegioId: req.colegioId!, nivelGradoId: matricula.nivelGradoId, activo: true }, orderBy: { nombre: 'asc' } });
  const notas = await prisma.nota.findMany({ where: { estudianteId, cursoId: { in: cursos.map(c => c.id) } } });

  const usaNumero = usaNumeroDirecto(matricula.nivelGrado.nivel);
  const porCurso = cursos.map(curso => {
    const notasDelCurso = notas.filter(n => n.cursoId === curso.id);
    const porBimestre: Record<string, any> = {};
    for (const b of ['BIMESTRE_1', 'BIMESTRE_2', 'BIMESTRE_3', 'BIMESTRE_4']) {
      const n = notasDelCurso.find(x => x.periodo === b);
      porBimestre[b] = n ? { literal: n.calificacionLiteral, numerica: Number(n.calificacionNumerica) } : null;
    }
    // Se filtra por != null ANTES de convertir a número — Number(null) da 0
    // (no NaN), así que sin este filtro una nota sin numérica guardada se
    // colaría en el promedio como si fuera un 0 real, bajándolo sin razón.
    const numeros = notasDelCurso.filter(n => n.calificacionNumerica != null).map(n => Number(n.calificacionNumerica)).filter(x => !isNaN(x));
    const promedio = numeros.length ? numeros.reduce((a, b) => a + b, 0) / numeros.length : null;
    return {
      curso: { id: curso.id, nombre: curso.nombre, areaCurricular: curso.areaCurricular },
      bimestres: porBimestre,
      promedio: promedio != null ? Math.round(promedio * 100) / 100 : null,
      promedioLiteral: promedio != null ? numeroABanda(promedio).literal : null,
    };
  });

  res.json({
    ok: true,
    data: {
      estudiante: { id: estudiante.id, nombres: estudiante.nombres, apellidos: estudiante.apellidos, dni: estudiante.dni, fotoUrl: estudiante.fotoUrl },
      grado: matricula.nivelGrado.nombre, seccion: matricula.seccion?.nombre, nivel: matricula.nivelGrado.nivel,
      anoEscolar: anoActual, usaNumero, cursos: porCurso,
    },
  });
});

// ── Recuperaciones ────────────────────────────────────────────────────────────
const recuperacionSchema = z.object({
  estudianteId: z.string(),
  cursoId:      z.string(),
  notaFinal:    z.number().min(0).max(20).optional().nullable(),
  aprobado:     z.boolean().optional().nullable(),
  fechaExamen:  z.string().datetime().optional().nullable(),
  observacion:  z.string().max(300).optional().nullable(),
});

router.get('/recuperaciones', isDocente, async (req, res) => {
  const { aulaId, cursoId } = req.query as Record<string, string>;
  const where: any = { colegioId: req.colegioId! };
  if (cursoId) where.cursoId = cursoId;
  if (aulaId) {
    const aula = await prisma.aula.findFirst({ where: { id: aulaId }, select: { seccionId: true } });
    const matriculas = await prisma.matricula.findMany({ where: { activa: true, anoEscolar: new Date().getFullYear(), seccionId: aula?.seccionId ?? '' }, select: { estudianteId: true } });
    where.estudianteId = { in: matriculas.map(m => m.estudianteId) };
  }
  const data = await prisma.recuperacion.findMany({
    where,
    include: { curso: { select: { nombre: true } }, estudiante: { select: { nombres: true, apellidos: true, dni: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, data });
});

router.post('/recuperaciones', isDocente, auditar({ modulo: 'RECUPERACIONES', accion: AuditoriaAccion.CREAR }), async (req, res) => {
  const data = recuperacionSchema.parse(req.body);
  const esStaff = ([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR] as string[]).includes(req.user!.rol);
  if (!esStaff) await verificarPermisoDocente(req.colegioId!, req.user!.id, data.cursoId, data.estudianteId);

  const recu = await prisma.recuperacion.upsert({
    where: { estudianteId_cursoId: { estudianteId: data.estudianteId, cursoId: data.cursoId } },
    create: { ...data, fechaExamen: data.fechaExamen ? new Date(data.fechaExamen) : null, colegioId: req.colegioId!, registradoPorId: req.user!.id },
    update: { ...data, fechaExamen: data.fechaExamen ? new Date(data.fechaExamen) : null, registradoPorId: req.user!.id },
  });
  res.status(201).json({ ok: true, data: recu });
});

export default router;
