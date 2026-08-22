// src/seed-demo-completo.ts — Semilla EXTENSA de TODO el sistema, para
// pruebas de punta a punta con volumen real de datos.
//
// A diferencia de seed-demo.ts (2 colegios chicos) y seed-demo-academico.ts
// (1 colegio enfocado solo en lo académico), esta semilla toca TODOS los
// módulos del sistema en 3 colegios con ~50 estudiantes cada uno:
// estructura académica, notas de los 4 bimestres, horarios, asistencia,
// pagos, comunicados, eventos, encuestas con respuestas, observaciones (los
// 6 tipos), permisos de salida, documentos, y chat — con TODOS los roles,
// incluyendo los opcionales (Contador, Auxiliar, Psicólogo, Enfermería,
// Tutor, Coordinador).
//
// Se borra con el MISMO comando de siempre (el slug sigue empezando con
// "demo-", que es lo que busca el script de borrado):
//   npm run seed:demo:completo      (crear — tarda varios minutos)
//   npm run seed:demo:eliminar      (borrar TODO — como si nunca hubiera existido)
//
// No toca ninguna tabla ni dato real — solo crea/borra filas nuevas
// filtradas siempre por colegioId de los colegios "demo-*" que esta semilla
// misma crea.
import 'dotenv/config';
import prisma from './config/prisma';
import { supabaseAdmin } from './config/supabase';
import {
  RolNombre, NivelEducativo, TipoBloque, PagoTipo, PagoEstado,
  AsistenciaEstado, EventoTipo, PermisoSalidaEstado, VinculoEstado,
  CalificacionLiteral, ObservacionTipo, DocumentoTipo, DocumentoEstado,
  EncuestaEstado,
} from '@prisma/client';

const PASSWORD_DEMO = 'Demo12345!';
const DOMINIO = 'demo.sige.pe';
const N_ESTUDIANTES_POR_COLEGIO = 50;

const NOMBRES_H = ['Mateo','Sebastián','Diego','Rodrigo','Fabián','Adrián','Joaquín','Santiago','Nicolás','Benjamín','Thiago','Emilio','Gael','Ian','Leonardo','Bruno'];
const NOMBRES_M = ['Valentina','Camila','Sofía','Antonella','Luciana','Mariana','Renata','Ariana','Fernanda','Gianella','Zoe','Abril','Ximena','Alessia','Emma','Dana'];
const APELLIDOS = ['Quispe','Rojas','Flores','Vargas','Gonzales','Torres','Ramírez','Castillo','Mendoza','Chávez','Huamán','Salazar','Paredes','Espinoza','Reyes','Aguilar'];
const rnd  = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const dniAleatorio = () => String(Math.floor(40000000 + Math.random() * 9000000));

async function crearUsuarioAuth(email: string, nombres: string, apellidos: string) {
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const existing = listData?.users?.find((u: any) => u.email === email);
  if (existing) {
    await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: PASSWORD_DEMO, email_confirm: true });
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password: PASSWORD_DEMO, email_confirm: true, user_metadata: { nombres, apellidos } });
  if (error) throw new Error(`Error creando auth user ${email}: ${error.message}`);
  return data.user.id;
}

async function crearUsuario(colegioId: string, rol: RolNombre, nombres: string, apellidos: string, email: string) {
  const supabaseId = await crearUsuarioAuth(email, nombres, apellidos);
  return prisma.usuario.upsert({
    where: { supabaseId }, update: { colegioId, rol },
    create: { supabaseId, colegioId, rol, nombres, apellidos, email, dni: dniAleatorio(), telefono: '9' + dniAleatorio().slice(1) },
  });
}

async function crearColegioCompleto(indice: 1 | 2 | 3) {
  const slug = `demo-completo-${indice}`;
  const nombre = `[DEMO] Colegio Prueba Completa ${indice}`;
  console.log(`\n🏫 [Colegio ${indice}/3] Creando "${nombre}"...`);

  const plan = await prisma.plan.upsert({
    where: { nombre: 'Plan Demo' }, update: {},
    create: { nombre: 'Plan Demo', descripcion: 'Plan usado solo por los colegios de prueba', precio: 199.9, duracionDias: 30, maxEstudiantes: 500, maxUsuarios: 150, maxAlmacenamientoGB: 10, modulosActivos: ['TODOS'], rolesHabilitados: [] },
  });
  const anoActual = new Date().getFullYear();
  const colegio = await prisma.colegio.upsert({
    where: { slug }, update: {},
    create: {
      slug, nombre, nombreCorto: nombre.replace('[DEMO] ', ''), ruc: `SEEDCOMPL${indice}${'0'.repeat(9)}`.slice(0, 11),
      direccion: `Av. Prueba Completa ${indice * 100}, Huánuco`, distrito: 'Huánuco', provincia: 'Huánuco', departamento: 'Huánuco', pais: 'PE',
      telefono: '062123456', email: `contacto@${slug}.pe`, estado: 'ACTIVO', planId: plan.id,
      licenciaInicio: new Date(), licenciaFin: new Date(Date.now() + 60 * 86400000), anoEscolarActual: anoActual,
      yapeNumero: '987654321', yapeTitular: 'Colegio Demo SAC', horaEntrada: '07:30', horaTardanza: '08:00', horaSalida: '13:00',
    },
  });
  await prisma.licencia.create({ data: { colegioId: colegio.id, planId: plan.id, estado: 'ACTIVA', fechaFin: new Date(Date.now() + 60 * 86400000), motivo: 'Semilla de prueba completa' } });

  // ── Staff: todos los roles, con varios docentes ──────────────────────────
  console.log('   👤 Creando staff (todos los roles)...');
  const sufijo = `.c${indice}@${DOMINIO}`;
  const administrador = await crearUsuario(colegio.id, RolNombre.ADMINISTRADOR, 'Ana', 'Administradora', `administrador${sufijo}`);
  const director      = await crearUsuario(colegio.id, RolNombre.DIRECTOR,      'Carlos', 'Director',      `director${sufijo}`);
  const secretaria     = await crearUsuario(colegio.id, RolNombre.SECRETARIA,   'Lucía', 'Secretaria',      `secretaria${sufijo}`);
  const contador       = await crearUsuario(colegio.id, RolNombre.CONTADOR,     'Rosa', 'Contadora',        `contador${sufijo}`);
  const auxiliar       = await crearUsuario(colegio.id, RolNombre.AUXILIAR,     'Elena', 'Auxiliar',        `auxiliar${sufijo}`);
  const psicologo      = await crearUsuario(colegio.id, RolNombre.PSICOLOGO,    'David', 'Psicólogo',       `psicologo${sufijo}`);
  const enfermeria      = await crearUsuario(colegio.id, RolNombre.ENFERMERIA,  'Carmen', 'Enfermera',      `enfermeria${sufijo}`);
  const coordinador     = await crearUsuario(colegio.id, RolNombre.COORDINADOR, 'Karla', 'Coordinadora',    `coordinador${sufijo}`);
  const docentes: any[] = [];
  for (let i = 0; i < 6; i++) docentes.push(await crearUsuario(colegio.id, i < 5 ? RolNombre.DOCENTE : RolNombre.TUTOR, rnd(NOMBRES_H.concat(NOMBRES_M)), `Docente ${i + 1}`, `docente${i + 1}${sufijo}`));
  const staffTodos = [administrador, director, secretaria, contador, auxiliar, psicologo, enfermeria, coordinador, ...docentes];

  // ── Estructura académica: 8 grados (2 inicial, 3 primaria, 3 secundaria) ──
  console.log('   🏛️  Creando grados, secciones, aulas y cursos...');
  const CURSOS_INICIAL = ['Comunicación', 'Matemática', 'Personal Social', 'Psicomotricidad', 'Arte y Cultura'];
  const CURSOS_PRIMARIA = ['Comunicación', 'Matemática', 'Personal Social', 'Ciencia y Tecnología', 'Arte y Cultura', 'Educación Física', 'Inglés'];
  const CURSOS_SECUNDARIA = ['Comunicación', 'Matemática', 'Ciencias Sociales', 'DPCC', 'Ciencia y Tecnología', 'Educación Física', 'Inglés'];
  const gradosDef = [
    { nivel: NivelEducativo.INICIAL, grado: 3, nombre: '3 años' }, { nivel: NivelEducativo.INICIAL, grado: 5, nombre: '5 años' },
    { nivel: NivelEducativo.PRIMARIA, grado: 1, nombre: '1° Primaria' }, { nivel: NivelEducativo.PRIMARIA, grado: 3, nombre: '3° Primaria' }, { nivel: NivelEducativo.PRIMARIA, grado: 6, nombre: '6° Primaria' },
    { nivel: NivelEducativo.SECUNDARIA, grado: 1, nombre: '1° Secundaria' }, { nivel: NivelEducativo.SECUNDARIA, grado: 3, nombre: '3° Secundaria' }, { nivel: NivelEducativo.SECUNDARIA, grado: 5, nombre: '5° Secundaria' },
  ];

  const grados: { nivelGrado: any; seccion: any; aula: any; docente: any; cursos: any[] }[] = [];
  for (const [i, g] of gradosDef.entries()) {
    const nivelGrado = await prisma.nivelGrado.upsert({
      where: { colegioId_nivel_grado: { colegioId: colegio.id, nivel: g.nivel, grado: g.grado } },
      update: {}, create: { colegioId: colegio.id, nivel: g.nivel, grado: g.grado, nombre: g.nombre },
    });
    const seccion = await prisma.seccion.upsert({
      where: { nivelGradoId_nombre: { nivelGradoId: nivelGrado.id, nombre: 'A' } },
      update: {}, create: { nivelGradoId: nivelGrado.id, nombre: 'A', capacidad: 30 },
    });
    const docenteDelGrado = docentes[i % docentes.length];
    const aula = await prisma.aula.create({ data: { colegioId: colegio.id, seccionId: seccion.id, nombre: `${g.nombre} "A"`, capacidad: 30, docenteTutorId: docenteDelGrado.id } });

    const listaCursos = g.nivel === 'INICIAL' ? CURSOS_INICIAL : g.nivel === 'PRIMARIA' ? CURSOS_PRIMARIA : CURSOS_SECUNDARIA;
    const cursos = [];
    for (const nombreCurso of listaCursos) {
      const curso = await prisma.curso.create({ data: { colegioId: colegio.id, nivelGradoId: nivelGrado.id, nombre: nombreCurso } });
      cursos.push(curso);
      const docenteDelCurso = rnd(docentes);
      await prisma.docenteAula.create({ data: { usuarioId: docenteDelCurso.id, aulaId: aula.id, cursoId: curso.id, materia: curso.nombre, esTutor: docenteDelCurso.id === docenteDelGrado.id, activo: true } });
      for (let dia = 1; dia <= 5; dia++) {
        await prisma.horario.create({ data: { colegioId: colegio.id, nivelGradoId: nivelGrado.id, seccionId: seccion.id, aulaId: aula.id, docenteId: docenteDelCurso.id, cursoId: curso.id, diaSemana: dia, horaInicio: '08:00', horaFin: '09:30', materia: curso.nombre, tipoBloque: TipoBloque.CLASE } });
      }
    }
    grados.push({ nivelGrado, seccion, aula, docente: docenteDelGrado, cursos });
  }

  // ── ~50 estudiantes, repartidos entre los 8 grados, con padres ───────────
  console.log(`   🎓 Creando ${N_ESTUDIANTES_POR_COLEGIO} estudiantes, matrículas y padres...`);
  const todosEstudiantes: { estudiante: any; grado: typeof grados[0] }[] = [];
  const padresCreados: any[] = [];
  let padreCounter = 0;

  for (let i = 0; i < N_ESTUDIANTES_POR_COLEGIO; i++) {
    const grado = grados[i % grados.length];
    const esVaron = Math.random() > 0.5;
    const nombres = rnd(esVaron ? NOMBRES_H : NOMBRES_M);
    const apellidos = `${rnd(APELLIDOS)} ${rnd(APELLIDOS)}`;
    const estudiante = await prisma.estudiante.create({
      data: {
        colegioId: colegio.id, dni: dniAleatorio(), nombres, apellidos,
        fechaNacimiento: new Date(anoActual - (3 + grado.nivelGrado.grado), i % 12, (i % 27) + 1),
        genero: esVaron ? 'M' : 'F', direccion: `Jr. Demo ${i + 1} s/n, Huánuco`,
        codigoQR: `DEMO-C${indice}-${String(i + 1).padStart(4, '0')}`, anoIngreso: anoActual, tipoSangre: rnd(['O+', 'A+', 'B+', 'AB+', 'O-']),
      },
    });
    await prisma.matricula.create({ data: { colegioId: colegio.id, estudianteId: estudiante.id, nivelGradoId: grado.nivelGrado.id, seccionId: grado.seccion.id, anoEscolar: anoActual } });
    todosEstudiantes.push({ estudiante, grado });

    // 1 de cada 3 comparte padre con el anterior (padres con 2-3 hijos)
    let padre;
    if (i % 3 !== 0 && padresCreados.length > 0) {
      padre = padresCreados[padresCreados.length - 1];
    } else {
      padreCounter++;
      const email = `padre${padreCounter}.c${indice}@${DOMINIO}`;
      const nombresPadre = rnd(NOMBRES_H);
      const supabaseId = await crearUsuarioAuth(email, nombresPadre, apellidos);
      const usuarioPadre = await prisma.usuario.upsert({ where: { supabaseId }, update: { colegioId: colegio.id, rol: RolNombre.PADRE }, create: { supabaseId, colegioId: colegio.id, rol: RolNombre.PADRE, nombres: nombresPadre, apellidos, email, dni: dniAleatorio(), telefono: '9' + dniAleatorio().slice(1) } });
      padre = await prisma.padre.upsert({ where: { usuarioId: usuarioPadre.id }, update: {}, create: { colegioId: colegio.id, usuarioId: usuarioPadre.id, dni: usuarioPadre.dni!, nombres: nombresPadre, apellidos, email, telefono: usuarioPadre.telefono } });
      padresCreados.push(padre);
    }
    await prisma.padreEstudiante.create({ data: { padreId: padre.id, estudianteId: estudiante.id, parentesco: 'PADRE', esPrincipal: true, estado: VinculoEstado.APROBADO } });
  }
  console.log(`      ${todosEstudiantes.length} estudiantes, ${padresCreados.length} padres (varios con 2-3 hijos)`);

  // ── Notas: los 4 bimestres, ~15% de alumnos deliberadamente bajos ────────
  console.log('   📝 Registrando notas (4 bimestres por curso)...');
  const EQUIVALENTES: Record<string, number> = { AD: 19, A: 15.5, B: 12, C: 5 };
  const notasParaCrear: any[] = [];
  for (const { estudiante, grado } of todosEstudiantes) {
    const vaJalado = Math.random() < 0.15;
    for (const curso of grado.cursos) {
      for (const periodo of ['BIMESTRE_1', 'BIMESTRE_2', 'BIMESTRE_3', 'BIMESTRE_4'] as const) {
        if (grado.nivelGrado.nivel === 'SECUNDARIA') {
          const numerica = vaJalado ? 8 + Math.floor(Math.random() * 3) : 12 + Math.floor(Math.random() * 9);
          const literal: CalificacionLiteral = numerica >= 18 ? 'AD' : numerica >= 14 ? 'A' : numerica >= 11 ? 'B' : 'C';
          notasParaCrear.push({ colegioId: colegio.id, estudianteId: estudiante.id, cursoId: curso.id, periodo, calificacionNumerica: numerica, calificacionLiteral: literal, registradoPorId: grado.docente.id });
        } else {
          const opciones: CalificacionLiteral[] = grado.nivelGrado.nivel === 'INICIAL'
            ? (vaJalado ? ['C', 'B'] : ['A', 'A', 'B'])
            : (vaJalado ? ['C', 'B'] : ['AD', 'A', 'A', 'B']);
          const literal = rnd(opciones);
          notasParaCrear.push({ colegioId: colegio.id, estudianteId: estudiante.id, cursoId: curso.id, periodo, calificacionLiteral: literal, calificacionNumerica: EQUIVALENTES[literal], registradoPorId: grado.docente.id });
        }
      }
    }
  }
  await prisma.nota.createMany({ data: notasParaCrear, skipDuplicates: true });
  console.log(`      ${notasParaCrear.length} notas creadas`);

  // ── Recuperaciones: para quienes quedaron con promedio bajo ──────────────
  const secundariaEstudiantes = todosEstudiantes.filter(e => e.grado.nivelGrado.nivel === 'SECUNDARIA').slice(0, 4);
  for (const [i, { estudiante, grado }] of secundariaEstudiantes.entries()) {
    await prisma.recuperacion.create({ data: { colegioId: colegio.id, estudianteId: estudiante.id, cursoId: grado.cursos[0].id, notaFinal: i % 2 === 0 ? 13 : null, aprobado: i % 2 === 0 ? true : null, fechaExamen: i % 2 === 0 ? new Date() : null, observacion: i % 2 === 0 ? 'Examen de recuperación rendido (semilla)' : null, registradoPorId: grado.docente.id } });
  }

  // ── Pagos: matrícula + 3 meses de pensión por estudiante ─────────────────
  console.log('   💳 Creando conceptos de pago y pagos...');
  const conceptoPension = await prisma.conceptoPago.create({ data: { colegioId: colegio.id, nombre: 'Pensión mensual', tipo: PagoTipo.PENSION, monto: 250, descripcion: 'Pensión de enseñanza' } });
  const conceptoMatricula = await prisma.conceptoPago.create({ data: { colegioId: colegio.id, nombre: 'Matrícula', tipo: PagoTipo.MATRICULA, monto: 350, descripcion: 'Matrícula anual', mesesAplicables: [1, 2, 3] } });
  const pagosParaCrear: any[] = [];
  for (const { estudiante } of todosEstudiantes) {
    const vinculo = await prisma.padreEstudiante.findFirst({ where: { estudianteId: estudiante.id } });
    if (!vinculo) continue;
    pagosParaCrear.push({ colegioId: colegio.id, padreId: vinculo.padreId, estudianteId: estudiante.id, conceptoId: conceptoMatricula.id, tipo: PagoTipo.MATRICULA, monto: 350, estado: PagoEstado.APROBADO, periodoPago: `${anoActual}-01`, fechaPago: new Date(anoActual, 0, 15), fechaAprobacion: new Date(anoActual, 0, 15), aprobadoPorId: administrador.id });
    for (let mes = 2; mes <= 4; mes++) {
      const estadoAleatorio = rnd([PagoEstado.APROBADO, PagoEstado.APROBADO, PagoEstado.APROBADO, PagoEstado.EN_REVISION, PagoEstado.PENDIENTE]);
      pagosParaCrear.push({
        colegioId: colegio.id, padreId: vinculo.padreId, estudianteId: estudiante.id, conceptoId: conceptoPension.id, tipo: PagoTipo.PENSION, monto: 250,
        estado: estadoAleatorio, periodoPago: `${anoActual}-${String(mes).padStart(2, '0')}`,
        fechaPago: estadoAleatorio === PagoEstado.APROBADO ? new Date(anoActual, mes - 1, 10) : null,
        fechaAprobacion: estadoAleatorio === PagoEstado.APROBADO ? new Date(anoActual, mes - 1, 10) : null,
        aprobadoPorId: estadoAleatorio === PagoEstado.APROBADO ? rnd([administrador, secretaria, contador]).id : null,
      });
    }
  }
  await prisma.pago.createMany({ data: pagosParaCrear });
  console.log(`      ${pagosParaCrear.length} pagos creados (matrícula + 3 meses de pensión por estudiante)`);

  // ── Comunicados (15) ──────────────────────────────────────────────────────
  for (let i = 0; i < 15; i++) {
    const grado = i % 3 === 0 ? null : rnd(grados);
    await prisma.comunicado.create({
      data: {
        colegioId: colegio.id, titulo: `[DEMO] Comunicado ${i + 1}`,
        contenido: `Comunicado de prueba número ${i + 1}, generado por la semilla completa, para verificar que se vea y se pueda leer bien desde cualquier rol.`,
        paraElColegio: !grado, nivelEducativo: grado?.nivelGrado.nivel, gradoId: grado?.nivelGrado.id, seccionId: grado ? grado.seccion.id : undefined,
        publicadoEn: new Date(Date.now() - i * 86400000), creadoPorId: rnd([...docentes, secretaria, director]).id,
      },
    });
  }

  // ── Eventos (15) ───────────────────────────────────────────────────────────
  const tiposEvento = [EventoTipo.REUNION, EventoTipo.ACTIVIDAD, EventoTipo.FERIADO, EventoTipo.SUSPENSION_CLASES, EventoTipo.OTRO];
  for (let i = 0; i < 15; i++) {
    const fecha = new Date(); fecha.setUTCDate(fecha.getUTCDate() + (i - 3) * 3);
    await prisma.evento.create({ data: { colegioId: colegio.id, titulo: `[DEMO] Evento ${i + 1}`, descripcion: 'Evento de prueba generado por la semilla completa', tipo: tiposEvento[i % tiposEvento.length], fechaInicio: fecha, todoElDia: true, lugar: 'Patio principal', creadoPorId: rnd([administrador, director, secretaria]).id } });
  }

  // ── Encuestas (2) con preguntas y respuestas ──────────────────────────────
  console.log('   📊 Creando encuestas con respuestas...');
  for (let e = 0; e < 2; e++) {
    const encuesta = await prisma.encuesta.create({ data: { colegioId: colegio.id, titulo: `[DEMO] Encuesta de satisfacción ${e + 1}`, descripcion: 'Encuesta generada por la semilla de prueba', estado: EncuestaEstado.ACTIVA, fechaInicio: new Date(Date.now() - 5 * 86400000), fechaFin: new Date(Date.now() + 10 * 86400000), creadaPorId: director.id } });
    const preguntas = [];
    const preg1 = await prisma.encuestaPregunta.create({ data: { encuestaId: encuesta.id, orden: 1, pregunta: '¿Cómo calificarías la comunicación del colegio?', tipo: 'OPCION_UNICA', opciones: ['Excelente', 'Buena', 'Regular', 'Mala'] } });
    const preg2 = await prisma.encuestaPregunta.create({ data: { encuestaId: encuesta.id, orden: 2, pregunta: '¿Algún comentario adicional?', tipo: 'TEXTO', opciones: [] } });
    preguntas.push(preg1, preg2);
    for (let r = 0; r < 8; r++) {
      const padre = rnd(padresCreados);
      const respuesta = await prisma.encuestaRespuesta.create({ data: { encuestaId: encuesta.id, padreId: padre.id, completada: true } });
      await prisma.encuestaRespuestaDetalle.create({ data: { respuestaId: respuesta.id, preguntaId: preg1.id, valor: rnd(['Excelente', 'Buena', 'Regular']) } });
      await prisma.encuestaRespuestaDetalle.create({ data: { respuestaId: respuesta.id, preguntaId: preg2.id, valor: 'Comentario de ejemplo generado por la semilla.' } });
    }
  }

  // ── Observaciones (20, con los 6 tipos incluyendo Salud/Psicológica) ─────
  const tiposObs = [ObservacionTipo.DISCIPLINARIA, ObservacionTipo.ACADEMICA, ObservacionTipo.CONDUCTUAL, ObservacionTipo.POSITIVA, ObservacionTipo.SALUD, ObservacionTipo.PSICOLOGICA];
  for (let i = 0; i < 20; i++) {
    const tipo = tiposObs[i % tiposObs.length];
    const creador = tipo === 'SALUD' ? enfermeria : tipo === 'PSICOLOGICA' ? psicologo : rnd(docentes);
    await prisma.observacion.create({
      data: {
        colegioId: colegio.id, estudianteId: rnd(todosEstudiantes).estudiante.id, tipo,
        descripcion: `Observación de prueba (${tipo}) generada por la semilla completa.`,
        accionTomada: 'Se conversó con el estudiante y se registró el seguimiento correspondiente.',
        creadoPorId: creador.id, notificadoPadre: i % 2 === 0,
      },
    });
  }

  // ── Permisos de salida (10) ────────────────────────────────────────────────
  const estadosPermiso = [PermisoSalidaEstado.SOLICITADO, PermisoSalidaEstado.AUTORIZADO, PermisoSalidaEstado.EJECUTADO, PermisoSalidaEstado.DENEGADO];
  for (let i = 0; i < 10; i++) {
    await prisma.permisoSalida.create({ data: { colegioId: colegio.id, estudianteId: rnd(todosEstudiantes).estudiante.id, motivo: 'Cita médica (demo)', estado: estadosPermiso[i % estadosPermiso.length], solicitadoPorId: rnd(docentes).id } });
  }

  // ── Documentos (10) ────────────────────────────────────────────────────────
  const tiposDoc = [DocumentoTipo.CONSTANCIA, DocumentoTipo.CERTIFICADO, DocumentoTipo.SOLICITUD];
  const estadosDoc = [DocumentoEstado.PENDIENTE, DocumentoEstado.EN_PROCESO, DocumentoEstado.LISTO, DocumentoEstado.ENTREGADO];
  for (let i = 0; i < 10; i++) {
    await prisma.documento.create({ data: { colegioId: colegio.id, estudianteId: rnd(todosEstudiantes).estudiante.id, tipo: tiposDoc[i % tiposDoc.length], nombre: `Documento de prueba ${i + 1}`, estado: estadosDoc[i % estadosDoc.length], solicitadoPorId: secretaria.id } });
  }

  // ── Chat: 10 conversaciones con varios mensajes cada una ──────────────────
  console.log('   💬 Creando conversaciones de chat...');
  for (let i = 0; i < 10; i++) {
    const { estudiante, grado } = rnd(todosEstudiantes);
    const vinculo = await prisma.padreEstudiante.findFirst({ where: { estudianteId: estudiante.id } });
    if (!vinculo) continue;
    const padre = await prisma.padre.findUnique({ where: { id: vinculo.padreId } });
    if (!padre?.usuarioId) continue;
    const conversacion = await prisma.conversacion.upsert({
      where: { padreUsuarioId_docenteUsuarioId_estudianteId: { padreUsuarioId: padre.usuarioId, docenteUsuarioId: grado.docente.id, estudianteId: estudiante.id } },
      update: {}, create: { colegioId: colegio.id, padreUsuarioId: padre.usuarioId, docenteUsuarioId: grado.docente.id, estudianteId: estudiante.id, ultimoMensajeEn: new Date(), ultimoMensajeTexto: 'Gracias por la información.' },
    });
    const mensajes = [
      { autorId: padre.usuarioId, contenido: `Buenos días, ¿cómo va ${estudiante.nombres} esta semana?`, leido: true },
      { autorId: grado.docente.id, contenido: 'Buenos días, va muy bien, sin novedades.', leido: true },
      { autorId: padre.usuarioId, contenido: 'Gracias por la información.', leido: i % 3 !== 0 },
    ];
    for (const m of mensajes) await prisma.mensaje.create({ data: { conversacionId: conversacion.id, autorId: m.autorId, contenido: m.contenido, leidoEn: m.leido ? new Date() : null } });
  }

  // ── Asistencia: últimos 10 días hábiles, para todos los estudiantes ──────
  console.log('   📋 Generando asistencia de los últimos 10 días...');
  const estadosAsist: AsistenciaEstado[] = [AsistenciaEstado.PRESENTE, AsistenciaEstado.PRESENTE, AsistenciaEstado.PRESENTE, AsistenciaEstado.PRESENTE, AsistenciaEstado.TARDANZA, AsistenciaEstado.AUSENTE];
  const asistParaCrear: any[] = [];
  for (const { estudiante } of todosEstudiantes) {
    for (let d = 0; d < 10; d++) {
      const fecha = new Date(); fecha.setDate(fecha.getDate() - d);
      const estado = rnd(estadosAsist);
      asistParaCrear.push({ colegioId: colegio.id, estudianteId: estudiante.id, fecha, estado, horaLlegada: estado !== 'AUSENTE' ? fecha : null, registradoPorId: administrador.id, escaneadoViaQR: true });
    }
  }
  await prisma.asistencia.createMany({ data: asistParaCrear, skipDuplicates: true });
  console.log(`      ${asistParaCrear.length} registros de asistencia creados`);

  console.log(`✅ [Colegio ${indice}/3] Listo — slug: ${slug}`);
  return { colegio, staff: { administrador, director, secretaria, contador, auxiliar, psicologo, enfermeria, coordinador, docentes } };
}

async function main() {
  console.log('🌱 Sembrando 3 colegios de prueba COMPLETOS (todos los módulos, volumen real)...');
  console.log('   Esto puede tardar varios minutos — crea decenas de usuarios reales en Supabase Auth.\n');

  const resultados = [];
  for (const indice of [1, 2, 3] as const) resultados.push(await crearColegioCompleto(indice));

  console.log('\n🎉 Semilla completa terminada.\n');
  console.log(`── Credenciales de acceso (contraseña para TODOS: ${PASSWORD_DEMO}) ──`);
  for (const [i, r] of resultados.entries()) {
    console.log(`\n${r.colegio.nombre}  (${r.colegio.slug}):`);
    console.log(`  Administrador: administrador.c${i + 1}@${DOMINIO}`);
    console.log(`  Director:      director.c${i + 1}@${DOMINIO}`);
    console.log(`  Secretaria:    secretaria.c${i + 1}@${DOMINIO}`);
    console.log(`  Contador:      contador.c${i + 1}@${DOMINIO}`);
    console.log(`  Auxiliar:      auxiliar.c${i + 1}@${DOMINIO}`);
    console.log(`  Psicólogo:     psicologo.c${i + 1}@${DOMINIO}`);
    console.log(`  Enfermería:    enfermeria.c${i + 1}@${DOMINIO}`);
    console.log(`  Coordinador:   coordinador.c${i + 1}@${DOMINIO}`);
    console.log(`  Docente 1:     docente1.c${i + 1}@${DOMINIO}`);
    console.log(`  Padre 1:       padre1.c${i + 1}@${DOMINIO}`);
  }
  console.log('\nPara borrar TODO esto (los 3 colegios completos): npm run seed:demo:eliminar\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
