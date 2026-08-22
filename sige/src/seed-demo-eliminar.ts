// src/seed-demo-eliminar.ts — Borra TODO lo creado por seed-demo.ts
//
// Solo toca colegios cuyo slug empieza con "demo-" (los que crea
// seed-demo.ts) — nunca toca tus colegios reales. Borra en el orden
// correcto para no chocar con las relaciones (FK), incluyendo las cuentas
// de Supabase Auth de los usuarios demo, para que quede como si la semilla
// nunca se hubiera corrido.
//
// Uso: npm run seed:demo:eliminar
import 'dotenv/config';
import prisma from './config/prisma';
import { supabaseAdmin } from './config/supabase';

async function main() {
  const colegiosDemo = await prisma.colegio.findMany({ where: { slug: { startsWith: 'demo-' } } });
  if (colegiosDemo.length === 0) {
    console.log('No hay colegios demo para eliminar (¿ya los borraste, o nunca corriste la semilla?).');
    return;
  }
  const colegioIds = colegiosDemo.map(c => c.id);
  console.log(`🗑️  Eliminando ${colegiosDemo.length} colegio(s) demo: ${colegiosDemo.map(c => c.slug).join(', ')}`);

  const estudiantes = await prisma.estudiante.findMany({ where: { colegioId: { in: colegioIds } }, select: { id: true } });
  const estudianteIds = estudiantes.map(e => e.id);
  const padres = await prisma.padre.findMany({ where: { colegioId: { in: colegioIds } }, select: { id: true, usuarioId: true } });
  const padreIds = padres.map(p => p.id);
  const usuarios = await prisma.usuario.findMany({ where: { colegioId: { in: colegioIds } }, select: { id: true, supabaseId: true, email: true } });
  const usuarioIds = usuarios.map(u => u.id);
  const encuestas = await prisma.encuesta.findMany({ where: { colegioId: { in: colegioIds } }, select: { id: true } });
  const encuestaIds = encuestas.map(e => e.id);
  const aulas = await prisma.aula.findMany({ where: { colegioId: { in: colegioIds } }, select: { id: true } });
  const aulaIds = aulas.map(a => a.id);

  // ── 0) Sistema académico (Chat, Notas, Recuperaciones, Cursos) ───────────
  // IMPORTANTE: esto tiene que ir ANTES de borrar Usuarios — `notas.
  // registradoPorId`, `recuperaciones.registradoPorId` y `mensajes.autorId`
  // están configurados como ON DELETE RESTRICT (a propósito, para no perder
  // silenciosamente quién registró una nota real). Si se intenta borrar un
  // Usuario que todavía tiene una Nota/Recuperación/Mensaje apuntándole,
  // la base de datos rechaza el borrado — así que el orden aquí no es
  // opcional.
  const conversaciones = await prisma.conversacion.findMany({ where: { colegioId: { in: colegioIds } }, select: { id: true } });
  await prisma.mensaje.deleteMany({ where: { conversacionId: { in: conversaciones.map(c => c.id) } } });
  await prisma.conversacion.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.recuperacion.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.nota.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.curso.deleteMany({ where: { colegioId: { in: colegioIds } } });

  // ── 1) Tablas "hoja" que dependen de estudiante/padre/usuario/encuesta ──
  await prisma.notificacion.deleteMany({ where: { OR: [{ usuarioId: { in: usuarioIds } }, { padreId: { in: padreIds } }] } });
  await prisma.auditoria.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.exportacion.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.chatbotPregunta.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.backup.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.encuestaRespuesta.deleteMany({ where: { encuestaId: { in: encuestaIds } } });
  await prisma.encuesta.deleteMany({ where: { colegioId: { in: colegioIds } } }); // borra EncuestaPregunta en cascada (onDelete: Cascade)
  await prisma.observacion.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.permisoSalida.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.documento.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.pago.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.conceptoPago.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.comunicado.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.evento.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.asistencia.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.matricula.deleteMany({ where: { colegioId: { in: colegioIds } } });

  // ── 2) Vínculos padre-estudiante, luego padres y estudiantes ────────────
  await prisma.padreEstudiante.deleteMany({ where: { estudianteId: { in: estudianteIds } } });
  await prisma.docenteAula.deleteMany({ where: { OR: [{ usuarioId: { in: usuarioIds } }, { aulaId: { in: aulaIds } }] } });
  await prisma.estudiante.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.padre.deleteMany({ where: { colegioId: { in: colegioIds } } });

  // ── 3) Estructura académica ───────────────────────────────────────────────
  await prisma.horario.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.aula.deleteMany({ where: { colegioId: { in: colegioIds } } });
  // Secciones cuelgan de nivelGrado, sin colegioId directo
  const niveles = await prisma.nivelGrado.findMany({ where: { colegioId: { in: colegioIds } }, select: { id: true } });
  await prisma.seccion.deleteMany({ where: { nivelGradoId: { in: niveles.map(n => n.id) } } });
  await prisma.nivelGrado.deleteMany({ where: { colegioId: { in: colegioIds } } });

  // ── 4) Usuarios (primero Supabase Auth, luego la fila en la BD) ─────────
  for (const u of usuarios) {
    try { await supabaseAdmin.auth.admin.deleteUser(u.supabaseId); } catch { /* puede que ya no exista */ }
  }
  await prisma.usuario.deleteMany({ where: { colegioId: { in: colegioIds } } });

  // ── 5) Facturación y el colegio en sí ─────────────────────────────────────
  await prisma.pagoLicencia.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.licencia.deleteMany({ where: { colegioId: { in: colegioIds } } });
  await prisma.colegio.deleteMany({ where: { id: { in: colegioIds } } });

  // El "Plan Demo" se deja (lo reutiliza la próxima vez que corras la semilla)
  // salvo que ya no lo use ningún colegio — en ese caso también se limpia.
  const planDemo = await prisma.plan.findUnique({ where: { nombre: 'Plan Demo' } });
  if (planDemo) {
    const enUso = await prisma.colegio.count({ where: { planId: planDemo.id } });
    if (enUso === 0) await prisma.plan.delete({ where: { id: planDemo.id } });
  }

  console.log(`✅ Listo — ${colegiosDemo.length} colegio(s) demo y todos sus datos fueron eliminados (incluyendo sus cuentas de Supabase Auth).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
