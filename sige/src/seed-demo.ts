// src/seed-demo.ts — Semilla de datos de PRUEBA (2 colegios demo)
//
// Crea 2 colegios completos, cada uno con: plan+licencia activa, ~10
// estudiantes matriculados, sus padres vinculados (algunos con 2 hijos),
// administrador + director + secretaria + 3 docentes, niveles/grados/aulas/
// secciones, horarios, conceptos de pago + ~10 pagos (algunos aprobados,
// algunos pendientes), ~5 comunicados, ~5 eventos, asistencia de los
// últimos 5 días para cada estudiante, y 3 permisos de salida.
//
// TODO lo creado queda marcado para poder borrarlo limpio después con
// `npm run seed:demo:eliminar` — SIN tocar tus datos reales:
//   - colegio.slug empieza con "demo-"
//   - colegio.ruc empieza con "SEEDDEMO"
//   - todos los emails de usuario terminan en "@demo.sige.pe"
//
// Uso:
//   npm run seed:demo            (crear)
//   npm run seed:demo:eliminar   (borrar todo lo de arriba, como si nunca hubiera existido)
import 'dotenv/config';
import prisma from './config/prisma';
import { supabaseAdmin } from './config/supabase';
import {
  RolNombre, NivelEducativo, TipoBloque, PagoTipo, PagoEstado,
  AsistenciaEstado, EventoTipo, PermisoSalidaEstado, VinculoEstado, Prisma,
} from '@prisma/client';

const PASSWORD_DEMO = 'Demo12345!';
const DOMINIO = 'demo.sige.pe';

const NOMBRES_H = ['Mateo','Sebastián','Diego','Rodrigo','Fabián','Adrián','Joaquín','Santiago','Nicolás','Benjamín'];
const NOMBRES_M = ['Valentina','Camila','Sofía','Antonella','Luciana','Mariana','Renata','Ariana','Fernanda','Gianella'];
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

async function crearColegioDemo(indice: 1 | 2) {
  const nombre = indice === 1 ? '[DEMO] Colegio Los Andes' : '[DEMO] Colegio Pacífico';
  const slug   = `demo-${indice === 1 ? 'los-andes' : 'pacifico'}`;
  const ruc    = `SEEDDEMO${indice}${'0'.repeat(10)}`.slice(0, 11);
  console.log(`\n🏫 Creando colegio demo ${indice}: ${nombre}...`);

  const plan = await prisma.plan.upsert({
    where: { nombre: 'Plan Demo' },
    update: {},
    create: {
      nombre: 'Plan Demo', descripcion: 'Plan usado solo por los colegios de prueba',
      precio: 199.90, duracionDias: 30, maxEstudiantes: 500, maxUsuarios: 100,
      maxAlmacenamientoGB: 10, modulosActivos: ['TODOS'], rolesHabilitados: [],
    },
  });

  const anoActual = new Date().getFullYear();
  const colegio = await prisma.colegio.upsert({
    where: { slug },
    update: {},
    create: {
      slug, nombre, nombreCorto: nombre.replace('[DEMO] ', ''), ruc,
      direccion: indice === 1 ? 'Av. Los Álamos 456, Huánuco' : 'Jr. Las Palmeras 789, Huánuco',
      distrito: 'Huánuco', provincia: 'Huánuco', departamento: 'Huánuco', pais: 'PE',
      telefono: '062123456', email: `contacto@${slug}.pe`,
      estado: 'ACTIVO', planId: plan.id,
      licenciaInicio: new Date(), licenciaFin: new Date(Date.now() + 60 * 86400000),
      anoEscolarActual: anoActual,
      yapeNumero: '987654321', yapeTitular: 'Colegio Demo SAC',
      horaEntrada: '07:30', horaTardanza: '08:00', horaSalida: '13:00',
    },
  });

  await prisma.licencia.create({
    data: { colegioId: colegio.id, planId: plan.id, estado: 'ACTIVA', fechaFin: new Date(Date.now() + 60 * 86400000), motivo: 'Semilla de prueba' },
  });

  // ── Usuarios de staff ────────────────────────────────────────────────────
  const staff: { rol: RolNombre; nombres: string; apellidos: string }[] = [
    { rol: RolNombre.ADMINISTRADOR, nombres: 'Ana',    apellidos: 'Administradora' },
    { rol: RolNombre.DIRECTOR,      nombres: 'Carlos', apellidos: 'Director' },
    { rol: RolNombre.SECRETARIA,    nombres: 'Lucía',  apellidos: 'Secretaria' },
    { rol: RolNombre.DOCENTE,       nombres: 'Pedro',  apellidos: 'Docente Uno' },
    { rol: RolNombre.DOCENTE,       nombres: 'María',  apellidos: 'Docente Dos' },
    { rol: RolNombre.DOCENTE,       nombres: 'Jorge',  apellidos: 'Docente Tres' },
  ];
  const usuariosStaff: Record<string, any[]> = { ADMINISTRADOR: [], DIRECTOR: [], SECRETARIA: [], DOCENTE: [] };
  for (const s of staff) {
    const email = `${s.rol.toLowerCase()}${usuariosStaff[s.rol].length + 1}.c${indice}@${DOMINIO}`;
    const supabaseId = await crearUsuarioAuth(email, s.nombres, s.apellidos);
    const usuario = await prisma.usuario.upsert({
      where: { supabaseId },
      update: { colegioId: colegio.id, rol: s.rol },
      create: { supabaseId, colegioId: colegio.id, rol: s.rol, nombres: s.nombres, apellidos: s.apellidos, email, dni: dniAleatorio(), telefono: '9' + dniAleatorio().slice(1) },
    });
    usuariosStaff[s.rol].push(usuario);
  }
  const admin = usuariosStaff.ADMINISTRADOR[0];
  console.log(`   👤 Staff creado (admin/secretaria/3 docentes/director) — login: ${staff.map((s,i)=>`${s.rol.toLowerCase()}${i<staff.filter(x=>x.rol===s.rol).length?'':''}`)}`);

  // ── Niveles/grados + secciones + aulas ──────────────────────────────────
  const nivelesDef = [
    { nivel: NivelEducativo.PRIMARIA, grado: 1, nombre: '1° Primaria' },
    { nivel: NivelEducativo.PRIMARIA, grado: 2, nombre: '2° Primaria' },
    { nivel: NivelEducativo.SECUNDARIA, grado: 1, nombre: '1° Secundaria' },
  ];
  const niveles = [];
  for (const n of nivelesDef) {
    const nivelGrado = await prisma.nivelGrado.upsert({
      where: { colegioId_nivel_grado: { colegioId: colegio.id, nivel: n.nivel, grado: n.grado } },
      update: {}, create: { colegioId: colegio.id, ...n },
    });
    const seccion = await prisma.seccion.upsert({
      where: { nivelGradoId_nombre: { nivelGradoId: nivelGrado.id, nombre: 'A' } },
      update: {}, create: { nivelGradoId: nivelGrado.id, nombre: 'A', capacidad: 30 },
    });
    const aula = await prisma.aula.create({
      data: { colegioId: colegio.id, seccionId: seccion.id, nombre: `${n.nombre} "A"`, capacidad: 30, docenteTutorId: rnd(usuariosStaff.DOCENTE).id },
    });
    niveles.push({ nivelGrado, seccion, aula });
  }

  // ── Horarios (unos bloques por nivel, dictados por los docentes demo) ───
  const materias = ['Matemática', 'Comunicación', 'Ciencia y Ambiente', 'Arte', 'Educación Física'];
  for (const { nivelGrado, seccion, aula } of niveles) {
    for (let dia = 1; dia <= 5; dia++) {
      await prisma.horario.create({
        data: {
          colegioId: colegio.id, nivelGradoId: nivelGrado.id, seccionId: seccion.id, aulaId: aula.id,
          docenteId: rnd(usuariosStaff.DOCENTE).id, diaSemana: dia,
          horaInicio: '08:00', horaFin: '09:30', materia: rnd(materias), tipoBloque: TipoBloque.CLASE,
        },
      });
    }
  }

  // ── Estudiantes + padres + matrículas (10 estudiantes) ──────────────────
  const estudiantes: any[] = [];
  const padres: any[] = [];
  for (let i = 0; i < 10; i++) {
    const esVaron = Math.random() > 0.5;
    const nombres = rnd(esVaron ? NOMBRES_H : NOMBRES_M);
    const apellidos = `${rnd(APELLIDOS)} ${rnd(APELLIDOS)}`;
    const { nivelGrado, seccion } = niveles[i % niveles.length];
    const estudiante = await prisma.estudiante.create({
      data: {
        colegioId: colegio.id, dni: dniAleatorio(), nombres, apellidos,
        fechaNacimiento: new Date(anoActual - (8 + (i % 6)), i % 12, (i % 27) + 1),
        genero: esVaron ? 'M' : 'F', direccion: `Jr. Demo ${i + 1} s/n, Huánuco`,
        codigoQR: `DEMO-C${indice}-${String(i + 1).padStart(4, '0')}`,
        anoIngreso: anoActual, tipoSangre: rnd(['O+','A+','B+','AB+','O-']),
      },
    });
    await prisma.matricula.create({
      data: { colegioId: colegio.id, estudianteId: estudiante.id, nivelGradoId: nivelGrado.id, seccionId: seccion.id, anoEscolar: anoActual },
    });
    estudiantes.push(estudiante);

    // Cada 2 estudiantes comparten un padre (para probar padres con 2 hijos)
    if (i % 2 === 0) {
      const email = `padre${(i / 2) + 1}.c${indice}@${DOMINIO}`;
      const nombresPadre = rnd(NOMBRES_H) + ' ' + rnd(NOMBRES_H);
      const apellidosPadre = apellidos;
      const supabaseId = await crearUsuarioAuth(email, nombresPadre, apellidosPadre);
      const usuarioPadre = await prisma.usuario.upsert({
        where: { supabaseId }, update: { colegioId: colegio.id, rol: RolNombre.PADRE },
        create: { supabaseId, colegioId: colegio.id, rol: RolNombre.PADRE, nombres: nombresPadre, apellidos: apellidosPadre, email, dni: dniAleatorio(), telefono: '9' + dniAleatorio().slice(1) },
      });
      const padre = await prisma.padre.upsert({
        where: { usuarioId: usuarioPadre.id }, update: {},
        create: { colegioId: colegio.id, usuarioId: usuarioPadre.id, dni: usuarioPadre.dni!, nombres: nombresPadre, apellidos: apellidosPadre, email, telefono: usuarioPadre.telefono } as Prisma.PadreUncheckedCreateInput,
      });
      padres.push(padre);
    }
    const padreDelEstudiante = padres[padres.length - 1];
    await prisma.padreEstudiante.create({
      data: { padreId: padreDelEstudiante.id, estudianteId: estudiante.id, parentesco: 'PADRE', esPrincipal: true, estado: VinculoEstado.APROBADO },
    });
  }
  console.log(`   🎓 ${estudiantes.length} estudiantes creados, ${padres.length} padres (algunos con 2 hijos)`);

  // ── Conceptos de pago + ~10 pagos ────────────────────────────────────────
  const conceptoPension = await prisma.conceptoPago.create({
    data: { colegioId: colegio.id, nombre: 'Pensión mensual', tipo: PagoTipo.PENSION, monto: 250, descripcion: 'Pensión de enseñanza' },
  });
  const conceptoMatricula = await prisma.conceptoPago.create({
    data: { colegioId: colegio.id, nombre: 'Matrícula', tipo: PagoTipo.MATRICULA, monto: 350, descripcion: 'Matrícula anual', mesesAplicables: [1,2,3] },
  });
  for (let i = 0; i < 10; i++) {
    const estudiante = estudiantes[i];
    const vinculo = await prisma.padreEstudiante.findFirst({ where: { estudianteId: estudiante.id } });
    const padreId = vinculo?.padreId ?? padres[0].id;
    const aprobado = i % 3 !== 0; // ~2/3 aprobados, 1/3 pendiente — para poder probar ambos estados
    await prisma.pago.create({
      data: {
        colegioId: colegio.id, padreId, estudianteId: estudiante.id,
        conceptoId: i % 2 === 0 ? conceptoPension.id : conceptoMatricula.id,
        tipo: i % 2 === 0 ? PagoTipo.PENSION : PagoTipo.MATRICULA,
        monto: i % 2 === 0 ? 250 : 350,
        estado: aprobado ? PagoEstado.APROBADO : PagoEstado.EN_REVISION,
        periodoPago: `${anoActual}-${String((i % 12) + 1).padStart(2, '0')}`,
        fechaPago: aprobado ? new Date() : null,
        fechaAprobacion: aprobado ? new Date() : null,
        aprobadoPorId: aprobado ? admin.id : null,
      },
    });
  }
  console.log('   💳 10 pagos creados (aprobados + en revisión)');

  // ── Comunicados (5) ──────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    await prisma.comunicado.create({
      data: {
        colegioId: colegio.id, titulo: `[DEMO] Comunicado ${i + 1}`,
        contenido: `Este es un comunicado de prueba número ${i + 1} generado por la semilla demo. Sirve para probar que Comunicados se vea y se pueda leer correctamente desde cualquier rol.`,
        paraElColegio: i % 2 === 0, nivelEducativo: i % 2 === 0 ? undefined : niveles[i % niveles.length].nivelGrado.nivel,
        gradoId: i % 2 === 0 ? undefined : niveles[i % niveles.length].nivelGrado.id,
        publicadoEn: new Date(), creadoPorId: rnd(usuariosStaff.DOCENTE.concat(usuariosStaff.SECRETARIA)).id,
      },
    });
  }

  // ── Eventos (5), incluyendo uno para "mañana" y uno para dentro de 2 semanas ─
  const tiposEvento = [EventoTipo.REUNION, EventoTipo.ACTIVIDAD, EventoTipo.FERIADO, EventoTipo.SUSPENSION_CLASES, EventoTipo.OTRO];
  for (let i = 0; i < 5; i++) {
    const fecha = new Date();
    fecha.setUTCDate(fecha.getUTCDate() + (i + 1) * 3);
    await prisma.evento.create({
      data: {
        colegioId: colegio.id, titulo: `[DEMO] Evento ${i + 1}`, descripcion: 'Evento de prueba generado por la semilla',
        tipo: tiposEvento[i], fechaInicio: fecha, todoElDia: true, lugar: 'Patio principal',
        creadoPorId: admin.id,
      },
    });
  }

  // ── Asistencia: últimos 5 días hábiles, para cada estudiante ─────────────
  const estados: AsistenciaEstado[] = [AsistenciaEstado.PRESENTE, AsistenciaEstado.PRESENTE, AsistenciaEstado.PRESENTE, AsistenciaEstado.TARDANZA, AsistenciaEstado.AUSENTE];
  for (const estudiante of estudiantes) {
    for (let d = 0; d < 5; d++) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - d);
      const estado = rnd(estados);
      try {
        await prisma.asistencia.create({
          data: {
            colegioId: colegio.id, estudianteId: estudiante.id, fecha,
            estado, horaLlegada: estado !== AsistenciaEstado.AUSENTE ? fecha : null,
            registradoPorId: admin.id, escaneadoViaQR: true,
          },
        });
      } catch { /* @@unique([colegioId, estudianteId, fecha]) — ignora duplicados si se re-corre */ }
    }
  }
  console.log('   📋 Asistencia de los últimos 5 días generada para todos los estudiantes');

  // ── Permisos de salida (3) ────────────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    await prisma.permisoSalida.create({
      data: {
        colegioId: colegio.id, estudianteId: estudiantes[i].id, motivo: 'Cita médica (demo)',
        estado: [PermisoSalidaEstado.SOLICITADO, PermisoSalidaEstado.AUTORIZADO, PermisoSalidaEstado.EJECUTADO][i],
        solicitadoPorId: rnd(usuariosStaff.DOCENTE).id,
      },
    });
  }

  console.log(`✅ Colegio demo ${indice} listo — slug: ${slug}`);
  return { colegio, admin, staff: usuariosStaff, estudiantes, padres };
}

async function main() {
  console.log('🌱 Sembrando datos de prueba (2 colegios demo)...');
  const c1 = await crearColegioDemo(1);
  const c2 = await crearColegioDemo(2);

  console.log('\n🎉 Semilla completada.\n');
  console.log('── Credenciales de acceso (contraseña para todos: ' + PASSWORD_DEMO + ') ──');
  for (const [i, c] of [c1, c2].entries()) {
    console.log(`\n${c.colegio.nombre}  (${c.colegio.slug}):`);
    console.log(`  Admin:      administrador1.c${i + 1}@${DOMINIO}`);
    console.log(`  Director:   director1.c${i + 1}@${DOMINIO}`);
    console.log(`  Secretaria: secretaria1.c${i + 1}@${DOMINIO}`);
    console.log(`  Docente:    docente1.c${i + 1}@${DOMINIO}`);
    console.log(`  Padre:      padre1.c${i + 1}@${DOMINIO}`);
  }
  console.log('\nPara borrar todo esto: npm run seed:demo:eliminar\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
