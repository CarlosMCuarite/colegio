// src/routes/horarios.ts
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isAdmin } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, RolNombre, Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

const horarioSchema = z.object({
  nivelGradoId:  z.string(),
  seccionId:     z.string().optional().nullable(),
  aulaId:        z.string().optional().nullable(),
  docenteId:     z.string().optional().nullable(),
  // Curso real que se dicta — antes solo existía "materia" como texto
  // libre, lo cual generaba nombres inconsistentes ("Mate", "Matemática",
  // "MATE 1") y no permitía registrar notas contra nada concreto. Ahora se
  // elige un Curso real; `materia` se autocompleta con su nombre y se
  // mantiene como texto libre SOLO para bloques que no son clase (Recreo,
  // Formación, etc.).
  cursoId:       z.string().optional().nullable(),
  diaSemana:     z.number().int().min(1).max(7),
  horaInicio:    z.string().regex(/^\d{2}:\d{2}$/),
  horaFin:       z.string().regex(/^\d{2}:\d{2}$/),
  materia:       z.string().min(2).default('Recreo'),
  tipoBloque:    z.enum(['CLASE','RECREO']).default('CLASE'),
  docenteNombre: z.string().optional().nullable(),
});

// Igual que horarioSchema pero acepta uno o varios días a la vez (p. ej. para
// crear el recreo de lunes a viernes en una sola llamada).
const horarioMultiDiaSchema = horarioSchema.omit({ diaSemana: true }).extend({
  diasSemana: z.array(z.number().int().min(1).max(7)).min(1),
});

const includeRelaciones = {
  nivelGrado: { select: { nivel: true, grado: true, nombre: true } },
  seccion:    { select: { nombre: true } },
  aula:       { select: { nombre: true } },
  docente:    { select: { id: true, nombres: true, apellidos: true } },
  curso:      { select: { id: true, nombre: true, areaCurricular: true } },
};

// Cuando el bloque tiene curso+docente+aula, además de guardar el horario se
// asegura que exista la asignación DocenteAula correspondiente — es lo que
// de verdad habilita al docente a registrar notas de ese curso (el horario
// en sí es solo la vista de calendario). Antes había que configurar esto
// dos veces por separado (horario Y asignación); ahora uno solo basta.
async function sincronizarAsignacionDocente(colegioId: string, data: { aulaId?: string | null; docenteId?: string | null; cursoId?: string | null }) {
  if (!data.aulaId || !data.docenteId || !data.cursoId) return;
  const curso = await prisma.curso.findUnique({ where: { id: data.cursoId }, select: { nombre: true } });

  // BUG REAL encontrado: antes solo buscaba por cursoId, así que si YA
  // existía una asignación "vieja" hecha a mano con `materia` en texto
  // libre (sin cursoId, de antes de que existiera este modelo) que
  // coincidiera justo con el nombre del curso, el `create` de abajo
  // chocaba contra la restricción única (usuarioId, aulaId, materia) y
  // tiraba abajo la creación del horario completo con un error 500. Ahora
  // se busca también por el texto de la materia, y si existe, se
  // ACTUALIZA esa fila con el cursoId real en vez de crear una duplicada.
  const existente = await prisma.docenteAula.findFirst({
    where: { usuarioId: data.docenteId, aulaId: data.aulaId, OR: [{ cursoId: data.cursoId }, ...(curso?.nombre ? [{ materia: curso.nombre }] : [])] },
  });
  if (existente) {
    if (existente.cursoId !== data.cursoId || !existente.activo) {
      await prisma.docenteAula.update({ where: { id: existente.id }, data: { cursoId: data.cursoId, materia: curso?.nombre ?? existente.materia, activo: true } });
    }
    return;
  }
  await prisma.docenteAula.create({
    data: { usuarioId: data.docenteId, aulaId: data.aulaId, cursoId: data.cursoId, materia: curso?.nombre ?? null, activo: true },
  });
}

// ── GET /horarios ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { nivelGradoId, seccionId, diaSemana } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId!, activo: true };
  if (nivelGradoId) where.nivelGradoId = nivelGradoId;
  if (seccionId)    where.seccionId    = seccionId;
  if (diaSemana)    where.diaSemana    = parseInt(diaSemana);

  // Docentes solo ven horarios donde ellos dictan, o de sus aulas asignadas
  if (req.user!.rol === RolNombre.DOCENTE) {
    const aulasDocente = await prisma.docenteAula.findMany({
      where: { usuarioId: req.user!.id },
      include: { aula: { select: { seccionId: true } } },
    });
    const seccionIds = aulasDocente.map(a => a.aula.seccionId).filter(Boolean);
    where.OR = [
      { docenteId: req.user!.id },
      ...(seccionIds.length ? [{ seccionId: { in: seccionIds } }] : []),
    ];
  }

  // Padres solo ven el horario de SUS hijos (por su matrícula activa del año
  // actual) — antes esto no filtraba nada y el padre veía el horario de
  // TODOS los grados del colegio mezclados.
  if (req.user!.rol === RolNombre.PADRE) {
    const padre = await prisma.padre.findFirst({ where: { usuarioId: req.user!.id, colegioId: req.colegioId! } });
    const anoActual = new Date().getFullYear();
    const matriculas = padre
      ? await prisma.matricula.findMany({
          where: { activa: true, anoEscolar: anoActual, estudiante: { padreEstudiantes: { some: { padreId: padre.id } } } },
          select: { nivelGradoId: true, seccionId: true },
        })
      : [];
    if (!matriculas.length) {
      return res.json({ ok: true, data: [], agrupado: {} });
    }
    where.OR = matriculas.map(m => ({ nivelGradoId: m.nivelGradoId, seccionId: m.seccionId }));
  }

  const horarios = await prisma.horario.findMany({
    where,
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    include: includeRelaciones,
  });

  const dias = ['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const agrupado = horarios.reduce((acc: any, h) => {
    const dia = dias[h.diaSemana];
    if (!acc[dia]) acc[dia] = [];
    acc[dia].push(h);
    return acc;
  }, {});

  res.json({ ok: true, data: horarios, agrupado });
});

// ── GET /horarios/docentes-disponibles — para el select del formulario ────────
router.get('/docentes-disponibles', async (req, res) => {
  const docentes = await prisma.usuario.findMany({
    where: { colegioId: req.colegioId!, activo: true, rol: { in: [RolNombre.DOCENTE, RolNombre.AUXILIAR, RolNombre.TUTOR, RolNombre.COORDINADOR] } },
    select: { id: true, nombres: true, apellidos: true, rol: true },
    orderBy: { apellidos: 'asc' },
  });
  res.json({ ok: true, data: docentes });
});

// ── GET /horarios/aulas-disponibles ───────────────────────────────────────────
router.get('/aulas-disponibles', async (req, res) => {
  const aulas = await prisma.aula.findMany({
    where: { colegioId: req.colegioId!, activo: true },
    select: {
      id: true, nombre: true, seccionId: true,
      seccion: { select: { nombre: true, nivelGrado: { select: { nombre: true } } } },
    },
    orderBy: { nombre: 'asc' },
  });
  res.json({ ok: true, data: aulas });
});

// ── GET /horarios/cursos-disponibles/:nivelGradoId — para el select del formulario ─
router.get('/cursos-disponibles/:nivelGradoId', async (req, res) => {
  const cursos = await prisma.curso.findMany({
    where: { colegioId: req.colegioId!, nivelGradoId: req.params.nivelGradoId, activo: true },
    orderBy: { nombre: 'asc' },
  });
  res.json({ ok: true, data: cursos });
});

// ── GET /horarios/grado/:nivelGradoId — Horario completo de un grado ──────────
router.get('/grado/:nivelGradoId', async (req, res) => {
  const { seccionId } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId!, nivelGradoId: req.params.nivelGradoId, activo: true };
  if (seccionId) where.seccionId = seccionId;
  const horarios = await prisma.horario.findMany({ where, orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }], include: includeRelaciones });
  res.json({ ok: true, data: horarios });
});

// ── Helper: valida solapamientos de sección/docente/aula para un día concreto ──
async function validarSolapamiento(colegioId: string, data: z.infer<typeof horarioSchema>) {
  // Verificar solapamiento en la misma sección/grado
  const solapado = await prisma.horario.findFirst({
    where: {
      colegioId,
      nivelGradoId: data.nivelGradoId,
      seccionId:    data.seccionId ?? null,
      diaSemana:    data.diaSemana,
      activo:       true,
      OR: [
        { horaInicio: { lte: data.horaInicio }, horaFin: { gt: data.horaInicio } },
        { horaInicio: { lt: data.horaFin },     horaFin: { gte: data.horaFin }  },
      ],
    },
  });
  if (solapado) throw new AppError(`Conflicto de horario con "${solapado.materia}" (${solapado.horaInicio}-${solapado.horaFin}) el ${['','lunes','martes','miércoles','jueves','viernes','sábado','domingo'][data.diaSemana]}`, 409);

  // Verificar que el docente no tenga otra clase a la misma hora en otra sección
  if (data.docenteId) {
    const docenteOcupado = await prisma.horario.findFirst({
      where: {
        colegioId, docenteId: data.docenteId, diaSemana: data.diaSemana, activo: true,
        OR: [
          { horaInicio: { lte: data.horaInicio }, horaFin: { gt: data.horaInicio } },
          { horaInicio: { lt: data.horaFin },     horaFin: { gte: data.horaFin }  },
        ],
      },
      include: { nivelGrado: { select: { nombre: true } } },
    });
    if (docenteOcupado) throw new AppError(`El docente ya tiene una clase en ${docenteOcupado.nivelGrado.nombre} a esa hora`, 409);
  }

  // Verificar que el aula (salón físico) no esté ocupada por OTRO grado/sección a la misma hora
  if (data.aulaId) {
    const aulaOcupada = await prisma.horario.findFirst({
      where: {
        colegioId, aulaId: data.aulaId, diaSemana: data.diaSemana, activo: true,
        OR: [
          { horaInicio: { lte: data.horaInicio }, horaFin: { gt: data.horaInicio } },
          { horaInicio: { lt: data.horaFin },     horaFin: { gte: data.horaFin }  },
        ],
      },
      include: { nivelGrado: { select: { nombre: true } }, aula: { select: { nombre: true } } },
    });
    if (aulaOcupada) throw new AppError(`El aula "${aulaOcupada.aula?.nombre}" ya está ocupada por ${aulaOcupada.nivelGrado.nombre} a esa hora`, 409);
  }
}

// ── POST /horarios ────────────────────────────────────────────────────────────
router.post(
  '/',
  isAdmin,
  auditar({ modulo: 'HORARIOS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const data = horarioSchema.parse(req.body);
    if (data.cursoId) {
      const curso = await prisma.curso.findFirst({ where: { id: data.cursoId, colegioId: req.colegioId! } });
      if (!curso) throw new AppError('Curso no encontrado', 404);
      data.materia = curso.nombre;
    }
    await validarSolapamiento(req.colegioId!, data);
    const horario = await prisma.horario.create({ data: { ...data, colegioId: req.colegioId! } as Prisma.HorarioUncheckedCreateInput, include: includeRelaciones });
    await sincronizarAsignacionDocente(req.colegioId!, data);
    res.status(201).json({ ok: true, data: horario });
  },
);

// ── POST /horarios/multi-dia — crea el mismo bloque (p. ej. un recreo) en ─────
// varios días a la vez, en lugar de tener que repetir el formulario por día.
router.post(
  '/multi-dia',
  isAdmin,
  auditar({ modulo: 'HORARIOS', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const { diasSemana, ...resto } = horarioMultiDiaSchema.parse(req.body);
    const creados = [];
    for (const diaSemana of diasSemana) {
      const data = horarioSchema.parse({ ...resto, diaSemana });
      await validarSolapamiento(req.colegioId!, data);
      const horario = await prisma.horario.create({ data: { ...data, colegioId: req.colegioId! } as Prisma.HorarioUncheckedCreateInput, include: includeRelaciones });
      creados.push(horario);
    }
    // BUG REAL encontrado: este endpoint nunca sincronizaba la asignación
    // docente↔curso — así que el caso MÁS COMÚN (crear un curso de lunes a
    // viernes de una sola vez, usando "varios días") dejaba al docente sin
    // poder registrar notas de ese curso, aunque su horario mostrara la
    // clase todos los días. Basta con sincronizar una vez (es la misma
    // asignación para los 5 días, no una por día).
    if (creados.length > 0) await sincronizarAsignacionDocente(req.colegioId!, creados[0]);
    res.status(201).json({ ok: true, data: creados });
  },
);

// ── POST /horarios/bulk — Crear múltiples entradas de una vez ─────────────────
router.post('/bulk', isAdmin, async (req, res) => {
  const schema = z.object({ horarios: z.array(horarioSchema).min(1).max(100) });
  const { horarios } = schema.parse(req.body);
  const created = await prisma.horario.createMany({
    data: horarios.map(h => ({ ...h, colegioId: req.colegioId! })) as Prisma.HorarioCreateManyInput[],
    skipDuplicates: true,
  });
  res.status(201).json({ ok: true, creados: created.count });
});

// ── PATCH /horarios/:id ───────────────────────────────────────────────────────
router.patch(
  '/:id',
  isAdmin,
  auditar({ modulo: 'HORARIOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const data = horarioSchema.partial().parse(req.body);
    if (data.cursoId) {
      const curso = await prisma.curso.findFirst({ where: { id: data.cursoId, colegioId: req.colegioId! } });
      if (!curso) throw new AppError('Curso no encontrado', 404);
      data.materia = curso.nombre;
    }
    const updated = await prisma.horario.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data });
    if (updated.count === 0) throw new AppError('Horario no encontrado', 404);
    if (data.cursoId) {
      const actual = await prisma.horario.findUnique({ where: { id: req.params.id } });
      if (actual) await sincronizarAsignacionDocente(req.colegioId!, actual);
    }
    res.json({ ok: true });
  },
);

// ── DELETE /horarios/:id ──────────────────────────────────────────────────────
router.delete(
  '/:id',
  isAdmin,
  auditar({ modulo: 'HORARIOS', accion: AuditoriaAccion.ELIMINAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    await prisma.horario.updateMany({ where: { id: req.params.id, colegioId: req.colegioId! }, data: { activo: false } });
    res.json({ ok: true });
  },
);

// ── DELETE /horarios/grado/:nivelGradoId — Limpiar todo el horario de un grado ─
router.delete(
  '/grado/:nivelGradoId',
  isAdmin,
  auditar({ modulo: 'HORARIOS', accion: AuditoriaAccion.ELIMINAR, getRecursoId: r => r.params.nivelGradoId }),
  async (req, res) => {
    const { seccionId } = req.query as Record<string,string>;
    const where: any = { colegioId: req.colegioId!, nivelGradoId: req.params.nivelGradoId };
    if (seccionId) where.seccionId = seccionId;
    const result = await prisma.horario.updateMany({ where, data: { activo: false } });
    res.json({ ok: true, eliminados: result.count });
  },
);

export default router;
