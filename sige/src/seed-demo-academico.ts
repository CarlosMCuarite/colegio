// src/seed-demo-academico.ts — Semilla EXTENSA para probar todo lo nuevo
// (v8.29 → v8.33): Cursos, Notas por bimestre (AD/A/B/C y 0-20), Boletín,
// Actas de evaluación/recuperación, Chat directo Padre↔Docente, Reportes
// ("Alumnos en riesgo"), y TODOS los roles opcionales (Contador, Auxiliar,
// Psicólogo, Enfermería, Tutor, Coordinador) — para poder iniciar sesión con
// cada uno y confirmar que ya no se quedan bloqueados.
//
// Crea UN colegio nuevo ("[DEMO] Colegio Académico Test", slug
// demo-academico) con 3 grados — uno por nivel (Inicial/Primaria/
// Secundaria) — así se puede probar la escala de notas correcta en cada
// uno (Inicial: A/B/C · Primaria: AD/A/B/C · Secundaria: 0-20) en la MISMA
// corrida.
//
// Usa el MISMO slug con prefijo "demo-" que la semilla original, así que
// se borra con el mismo comando de siempre:
//   npm run seed:demo:academico            (crear)
//   npm run seed:demo:eliminar             (borra ESTE y cualquier otro demo-*)
import 'dotenv/config';
import prisma from './config/prisma';
import { supabaseAdmin } from './config/supabase';
import {
  RolNombre, NivelEducativo, TipoBloque, AsistenciaEstado, VinculoEstado,
  CalificacionLiteral,
} from '@prisma/client';

const PASSWORD_DEMO = 'Demo12345!';
const DOMINIO = 'demo.sige.pe';
const SLUG = 'demo-academico';

const NOMBRES_H = ['Mateo','Sebastián','Diego','Rodrigo','Fabián','Adrián','Joaquín','Santiago','Nicolás','Benjamín','Thiago','Emilio'];
const NOMBRES_M = ['Valentina','Camila','Sofía','Antonella','Luciana','Mariana','Renata','Ariana','Fernanda','Gianella','Zoe','Abril'];
const APELLIDOS = ['Quispe','Rojas','Flores','Vargas','Gonzales','Torres','Ramírez','Castillo','Mendoza','Chávez','Huamán','Salazar'];
const rnd  = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const dniAleatorio = () => String(Math.floor(40000000 + Math.random() * 9000000));

async function crearUsuarioAuth(email: string, nombres: string, apellidos: string) {
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const existing = listData?.users?.find((u: any) => u.email === email);
  if (existing) {
    await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: PASSWORD_DEMO, email_confirm: true });
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password: PASSWORD_DEMO, email_confirm: true,
    user_metadata: { nombres, apellidos },
  });
  if (error) throw new Error(`Error creando auth user ${email}: ${error.message}`);
  return data.user.id;
}

async function crearStaff(colegioId: string, rol: RolNombre, nombres: string, apellidos: string, sufijo: string) {
  const email = `${rol.toLowerCase()}${sufijo}@${DOMINIO}`;
  const supabaseId = await crearUsuarioAuth(email, nombres, apellidos);
  return prisma.usuario.upsert({
    where: { supabaseId }, update: { colegioId, rol },
    create: { supabaseId, colegioId, rol, nombres, apellidos, email, dni: dniAleatorio(), telefono: '9' + dniAleatorio().slice(1) },
  });
}

async function main() {
  console.log('🌱 Sembrando colegio demo ACADÉMICO (prueba de v8.29 → v8.33)...\n');

  const plan = await prisma.plan.upsert({
    where: { nombre: 'Plan Demo' }, update: {},
    create: { nombre: 'Plan Demo', descripcion: 'Plan usado solo por los colegios de prueba', precio: 199.9, duracionDias: 30, maxEstudiantes: 500, maxUsuarios: 100, maxAlmacenamientoGB: 10, modulosActivos: ['TODOS'], rolesHabilitados: [] },
  });
  const anoActual = new Date().getFullYear();
  const colegio = await prisma.colegio.upsert({
    where: { slug: SLUG }, update: {},
    create: {
      slug: SLUG, nombre: '[DEMO] Colegio Académico Test', nombreCorto: 'Colegio Académico Test', ruc: 'SEEDDEMOAC001',
      direccion: 'Av. Prueba Académica 123, Huánuco', distrito: 'Huánuco', provincia: 'Huánuco', departamento: 'Huánuco', pais: 'PE',
      telefono: '062123456', email: `contacto@${SLUG}.pe`, estado: 'ACTIVO', planId: plan.id,
      licenciaInicio: new Date(), licenciaFin: new Date(Date.now() + 60 * 86400000), anoEscolarActual: anoActual,
      yapeNumero: '987654321', yapeTitular: 'Colegio Demo SAC', horaEntrada: '07:30', horaTardanza: '08:00', horaSalida: '13:00',
    },
  });
  await prisma.licencia.create({ data: { colegioId: colegio.id, planId: plan.id, estado: 'ACTIVA', fechaFin: new Date(Date.now() + 60 * 86400000), motivo: 'Semilla demo académica' } });

  // ── Staff: TODOS los roles opcionales, para poder loguearse con cada uno ──
  console.log('👤 Creando un usuario por cada rol (incluyendo los opcionales)...');
  const administrador = await crearStaff(colegio.id, RolNombre.ADMINISTRADOR, 'Ana', 'Administradora', '.academico');
  const director      = await crearStaff(colegio.id, RolNombre.DIRECTOR,      'Carlos', 'Director',      '.academico');
  const secretaria     = await crearStaff(colegio.id, RolNombre.SECRETARIA,   'Lucía', 'Secretaria',      '.academico');
  const contador       = await crearStaff(colegio.id, RolNombre.CONTADOR,     'Rosa', 'Contadora',        '.academico');
  const auxiliar       = await crearStaff(colegio.id, RolNombre.AUXILIAR,     'Elena', 'Auxiliar',        '.academico');
  const psicologo      = await crearStaff(colegio.id, RolNombre.PSICOLOGO,    'David', 'Psicólogo',       '.academico');
  const enfermeria      = await crearStaff(colegio.id, RolNombre.ENFERMERIA,  'Carmen', 'Enfermera',      '.academico');
  const docenteInicial = await crearStaff(colegio.id, RolNombre.DOCENTE,      'Pedro', 'Docente Inicial', '1.academico');
  const docentePrimaria= await crearStaff(colegio.id, RolNombre.DOCENTE,      'María', 'Docente Primaria','2.academico');
  const tutor          = await crearStaff(colegio.id, RolNombre.TUTOR,       'Jorge', 'Tutor Secundaria', '.academico');
  const coordinador     = await crearStaff(colegio.id, RolNombre.COORDINADOR, 'Karla', 'Coordinadora',    '.academico');

  // ── 3 grados, uno por nivel — para probar la escala completa ─────────────
  console.log('🏫 Creando 1 grado por nivel (Inicial / Primaria / Secundaria)...');
  const gradosDef = [
    { nivel: NivelEducativo.INICIAL,    grado: 5, nombre: '5 años',        docenteTutor: docenteInicial,  docente: docenteInicial },
    { nivel: NivelEducativo.PRIMARIA,   grado: 3, nombre: '3° Primaria',   docenteTutor: docentePrimaria, docente: docentePrimaria },
    { nivel: NivelEducativo.SECUNDARIA, grado: 2, nombre: '2° Secundaria', docenteTutor: tutor,           docente: tutor },
  ];
  const CURSOS_POR_NIVEL: Record<string, string[]> = {
    INICIAL:    ['Comunicación', 'Matemática', 'Personal Social'],
    PRIMARIA:   ['Comunicación', 'Matemática', 'Ciencia y Tecnología'],
    SECUNDARIA: ['Comunicación', 'Matemática', 'Ciencias Sociales'],
  };

  const grados: { nivelGrado: any; seccion: any; aula: any; docente: any; cursos: any[] }[] = [];
  for (const g of gradosDef) {
    const nivelGrado = await prisma.nivelGrado.upsert({
      where: { colegioId_nivel_grado: { colegioId: colegio.id, nivel: g.nivel, grado: g.grado } },
      update: {}, create: { colegioId: colegio.id, nivel: g.nivel, grado: g.grado, nombre: g.nombre },
    });
    const seccion = await prisma.seccion.upsert({
      where: { nivelGradoId_nombre: { nivelGradoId: nivelGrado.id, nombre: 'A' } },
      update: {}, create: { nivelGradoId: nivelGrado.id, nombre: 'A', capacidad: 30 },
    });
    const aula = await prisma.aula.create({ data: { colegioId: colegio.id, seccionId: seccion.id, nombre: `${g.nombre} "A"`, capacidad: 30, docenteTutorId: g.docenteTutor.id } });

    const cursos = [];
    for (const nombreCurso of CURSOS_POR_NIVEL[g.nivel]) {
      const curso = await prisma.curso.create({ data: { colegioId: colegio.id, nivelGradoId: nivelGrado.id, nombre: nombreCurso } });
      cursos.push(curso);
      // Asigna al docente del grado como quien dicta este curso — esto es
      // justo lo que antes había que configurar "dos veces" (ver LEEME de
      // v8.30) y lo que habilita registrar notas.
      await prisma.docenteAula.create({ data: { usuarioId: g.docente.id, aulaId: aula.id, cursoId: curso.id, materia: curso.nombre, esTutor: true, activo: true } });
      // Un horario de lunes a viernes por curso (para ver "Mis Horarios" con datos)
      for (let dia = 1; dia <= 5; dia++) {
        await prisma.horario.create({
          data: { colegioId: colegio.id, nivelGradoId: nivelGrado.id, seccionId: seccion.id, aulaId: aula.id, docenteId: g.docente.id, cursoId: curso.id, diaSemana: dia, horaInicio: '08:00', horaFin: '09:30', materia: curso.nombre, tipoBloque: TipoBloque.CLASE },
        });
      }
    }
    grados.push({ nivelGrado, seccion, aula, docente: g.docente, cursos });
  }

  // ── Estudiantes (5 por aula = 15) + padres (algunos con 2 hijos en niveles distintos) ─
  console.log('🎓 Creando estudiantes, matrículas y padres...');
  const todosEstudiantes: { estudiante: any; grado: typeof grados[0] }[] = [];
  const padresCreados: any[] = [];
  let contadorPadre = 0;

  for (const grado of grados) {
    for (let i = 0; i < 5; i++) {
      const esVaron = Math.random() > 0.5;
      const nombres = rnd(esVaron ? NOMBRES_H : NOMBRES_M);
      const apellidos = `${rnd(APELLIDOS)} ${rnd(APELLIDOS)}`;
      const estudiante = await prisma.estudiante.create({
        data: {
          colegioId: colegio.id, dni: dniAleatorio(), nombres, apellidos,
          fechaNacimiento: new Date(anoActual - (5 + grado.nivelGrado.grado), i % 12, (i % 27) + 1),
          genero: esVaron ? 'M' : 'F', direccion: `Jr. Demo Académico ${i + 1} s/n, Huánuco`,
          codigoQR: `DEMO-AC-${grado.nivelGrado.nivel.slice(0, 3)}-${String(i + 1).padStart(3, '0')}`,
          anoIngreso: anoActual, tipoSangre: rnd(['O+', 'A+', 'B+', 'AB+']),
        },
      });
      await prisma.matricula.create({ data: { colegioId: colegio.id, estudianteId: estudiante.id, nivelGradoId: grado.nivelGrado.id, seccionId: grado.seccion.id, anoEscolar: anoActual } });
      todosEstudiantes.push({ estudiante, grado });

      // El primer estudiante de Primaria y el primero de Secundaria comparten
      // el MISMO padre — para poder probar el selector de "varios hijos" en
      // Boletín/Asistencia/Chat cambiando entre un hijo de cada nivel.
      let padre;
      if (grado.nivelGrado.nivel === 'PRIMARIA' && i === 0) {
        contadorPadre++;
        const email = `padre${contadorPadre}.academico@${DOMINIO}`;
        const supabaseId = await crearUsuarioAuth(email, 'Roberto', apellidos);
        const usuarioPadre = await prisma.usuario.upsert({ where: { supabaseId }, update: { colegioId: colegio.id, rol: RolNombre.PADRE }, create: { supabaseId, colegioId: colegio.id, rol: RolNombre.PADRE, nombres: 'Roberto', apellidos, email, dni: dniAleatorio(), telefono: '9' + dniAleatorio().slice(1) } });
        padre = await prisma.padre.upsert({ where: { usuarioId: usuarioPadre.id }, update: {}, create: { colegioId: colegio.id, usuarioId: usuarioPadre.id, dni: usuarioPadre.dni!, nombres: 'Roberto', apellidos, email, telefono: usuarioPadre.telefono } });
        (padre as any).__esPadreDosHijos = true;
        padresCreados.push(padre);
      } else if (grado.nivelGrado.nivel === 'SECUNDARIA' && i === 0) {
        padre = padresCreados.find(p => (p as any).__esPadreDosHijos);
      } else {
        contadorPadre++;
        const email = `padre${contadorPadre}.academico@${DOMINIO}`;
        const nombresPadre = rnd(NOMBRES_H);
        const supabaseId = await crearUsuarioAuth(email, nombresPadre, apellidos);
        const usuarioPadre = await prisma.usuario.upsert({ where: { supabaseId }, update: { colegioId: colegio.id, rol: RolNombre.PADRE }, create: { supabaseId, colegioId: colegio.id, rol: RolNombre.PADRE, nombres: nombresPadre, apellidos, email, dni: dniAleatorio(), telefono: '9' + dniAleatorio().slice(1) } });
        padre = await prisma.padre.upsert({ where: { usuarioId: usuarioPadre.id }, update: {}, create: { colegioId: colegio.id, usuarioId: usuarioPadre.id, dni: usuarioPadre.dni!, nombres: nombresPadre, apellidos, email, telefono: usuarioPadre.telefono } });
        padresCreados.push(padre);
      }
      await prisma.padreEstudiante.create({ data: { padreId: padre.id, estudianteId: estudiante.id, parentesco: 'PADRE', esPrincipal: true, estado: VinculoEstado.APROBADO } });
    }
  }
  console.log(`   ${todosEstudiantes.length} estudiantes creados (${padresCreados.length} padres — uno de ellos con hijos en Primaria Y Secundaria)`);

  // ── Notas: Bimestre 1 y 2, con 2-3 alumnos deliberadamente jalados ───────
  console.log('📝 Registrando notas (Bimestre 1 y 2) — con algunos alumnos bajo el mínimo, para probar Recuperación...');
  const LITERAL_ALTO: Record<string, CalificacionLiteral[]> = { INICIAL: ['A', 'A', 'B'], PRIMARIA: ['AD', 'A', 'A', 'B'] };
  const LITERAL_BAJO: Record<string, CalificacionLiteral[]> = { INICIAL: ['C', 'B'], PRIMARIA: ['C', 'B'] };
  let estudiantesJalados = 0;

  for (const { estudiante, grado } of todosEstudiantes) {
    // Los primeros 2 estudiantes de Secundaria y el último de Primaria quedan
    // deliberadamente con promedio bajo, para poder probar Actas de
    // Recuperación con datos reales.
    const idxEnGrado = todosEstudiantes.filter(e => e.grado === grado).indexOf(todosEstudiantes.find(e => e.estudiante.id === estudiante.id)!);
    const vaJalado = (grado.nivelGrado.nivel === 'SECUNDARIA' && idxEnGrado < 2) || (grado.nivelGrado.nivel === 'PRIMARIA' && idxEnGrado === 4);
    if (vaJalado) estudiantesJalados++;

    for (const curso of grado.cursos) {
      for (const periodo of ['BIMESTRE_1', 'BIMESTRE_2'] as const) {
        if (grado.nivelGrado.nivel === 'SECUNDARIA') {
          const numerica = vaJalado ? 8 + Math.floor(Math.random() * 3) : 12 + Math.floor(Math.random() * 9);
          await prisma.nota.create({ data: { colegioId: colegio.id, estudianteId: estudiante.id, cursoId: curso.id, periodo, calificacionNumerica: numerica, calificacionLiteral: numerica >= 18 ? 'AD' : numerica >= 14 ? 'A' : numerica >= 11 ? 'B' : 'C', registradoPorId: grado.docente.id } });
        } else {
          const literal = rnd(vaJalado ? LITERAL_BAJO[grado.nivelGrado.nivel] : LITERAL_ALTO[grado.nivelGrado.nivel]);
          const equivalentes: Record<string, number> = { AD: 19, A: 15.5, B: 12, C: 5 };
          await prisma.nota.create({ data: { colegioId: colegio.id, estudianteId: estudiante.id, cursoId: curso.id, periodo, calificacionLiteral: literal, calificacionNumerica: equivalentes[literal], registradoPorId: grado.docente.id } });
        }
      }
    }
  }
  console.log(`   Notas registradas para los ${todosEstudiantes.length} estudiantes en sus ${grados[0].cursos.length} cursos (${estudiantesJalados} alumnos con promedio bajo, a propósito)`);

  // ── Recuperaciones: para los estudiantes jalados de Secundaria ───────────
  const jaladosSecundaria = todosEstudiantes.filter(({ grado }) => grado.nivelGrado.nivel === 'SECUNDARIA').slice(0, 2);
  for (const { estudiante, grado } of jaladosSecundaria) {
    await prisma.recuperacion.create({ data: { colegioId: colegio.id, estudianteId: estudiante.id, cursoId: grado.cursos[0].id, notaFinal: 13, aprobado: true, fechaExamen: new Date(), observacion: 'Examen de recuperación de prueba (semilla)', registradoPorId: grado.docente.id } });
  }
  console.log(`   ${jaladosSecundaria.length} recuperación(es) ya registrada(s) — así "Actas → Recuperación" tiene datos reales, no solo la lista pendiente`);

  // ── Chat: conversación entre el padre de 2 hijos y sus 2 docentes ─────────
  console.log('💬 Creando conversaciones de chat con mensajes de ejemplo...');
  const padreDosHijos = padresCreados.find(p => (p as any).__esPadreDosHijos);
  if (padreDosHijos) {
    const hijoPrimaria = todosEstudiantes.find(e => e.grado.nivelGrado.nivel === 'PRIMARIA' && e.grado.cursos.length > 0);
    const hijoSecundaria = todosEstudiantes.find(e => e.grado.nivelGrado.nivel === 'SECUNDARIA');
    for (const hijo of [hijoPrimaria, hijoSecundaria]) {
      if (!hijo) continue;
      const conversacion = await prisma.conversacion.create({
        data: {
          colegioId: colegio.id, padreUsuarioId: padreDosHijos.usuarioId!, docenteUsuarioId: hijo.grado.docente.id, estudianteId: hijo.estudiante.id,
          ultimoMensajeEn: new Date(), ultimoMensajeTexto: 'Perfecto, muchas gracias profesor(a).',
        },
      });
      const mensajesDemo = [
        { autorId: padreDosHijos.usuarioId!, contenido: `Buenos días, quería preguntar cómo va ${hijo.estudiante.nombres} en clase.`, leido: true },
        { autorId: hijo.grado.docente.id, contenido: 'Buenos días, va muy bien, participa activamente en clase.', leido: true },
        { autorId: padreDosHijos.usuarioId!, contenido: 'Perfecto, muchas gracias profesor(a).', leido: false },
      ];
      for (const m of mensajesDemo) {
        await prisma.mensaje.create({ data: { conversacionId: conversacion.id, autorId: m.autorId, contenido: m.contenido, leidoEn: m.leido ? new Date() : null } });
      }
    }
    console.log('   2 conversaciones creadas (una por cada hijo del padre con 2 hijos) — con un mensaje sin leer en cada una, para ver el badge');
  }

  // ── Asistencia de los últimos 5 días, para ver el calendario del Padre ───
  const estadosAsist: AsistenciaEstado[] = [AsistenciaEstado.PRESENTE, AsistenciaEstado.PRESENTE, AsistenciaEstado.PRESENTE, AsistenciaEstado.TARDANZA, AsistenciaEstado.AUSENTE];
  for (const { estudiante } of todosEstudiantes) {
    for (let d = 0; d < 5; d++) {
      const fecha = new Date(); fecha.setDate(fecha.getDate() - d);
      const estado = rnd(estadosAsist);
      try {
        await prisma.asistencia.create({ data: { colegioId: colegio.id, estudianteId: estudiante.id, fecha, estado, horaLlegada: estado !== 'AUSENTE' ? fecha : null, registradoPorId: administrador.id, escaneadoViaQR: true } });
      } catch { /* ya existe, se ignora */ }
    }
  }

  console.log('\n✅ Listo — colegio demo académico creado.\n');
  console.log(`── Credenciales (contraseña para todos: ${PASSWORD_DEMO}) ──`);
  console.log(`Colegio: ${colegio.nombre}  →  ${SLUG}\n`);
  console.log(`  Administrador:  ${administrador.email}`);
  console.log(`  Director:       ${director.email}`);
  console.log(`  Secretaria:     ${secretaria.email}`);
  console.log(`  Contador:       ${contador.email}   ← antes no podía ni entrar`);
  console.log(`  Auxiliar:       ${auxiliar.email}`);
  console.log(`  Psicólogo:      ${psicologo.email}`);
  console.log(`  Enfermería:     ${enfermeria.email}`);
  console.log(`  Docente Inicial:${docenteInicial.email}   (curso con escala A/B/C)`);
  console.log(`  Docente Primaria:${docentePrimaria.email}  (curso con escala AD/A/B/C)`);
  console.log(`  Tutor Secundaria:${tutor.email}   (curso con escala 0-20)`);
  console.log(`  Coordinador:    ${coordinador.email}`);
  if (padreDosHijos) console.log(`  Padre (2 hijos — uno en Primaria y otro en Secundaria): ${padreDosHijos.email}`);
  console.log('\nPara borrar todo esto (junto con cualquier otra semilla demo-*): npm run seed:demo:eliminar\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
