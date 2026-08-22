// src/routes/permisosSalida.ts
// Flujo: Docente solicita → Secretaría valida → llama al padre → Secretaría autoriza
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, isStaff, isDocente, isAdminDir } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, PermisoSalidaEstado } from '@prisma/client';
import { enviarNotificacion } from '../services/notificacionService';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant);

// Staff = quienes gestionan (ven/validan/autorizan) TODAS las solicitudes del
// colegio. Docente/Auxiliar/Tutor/Coordinador solo ven y crean las suyas.
function esStaffReq(req: any): boolean {
  return ['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA'].includes(req.user!.rol);
}

const permisoSchema = z.object({
  estudianteId: z.string(),
  motivo:       z.string().min(5),
  descripcion:  z.string().optional().nullable(),
});

// ── GET /permisos ─────────────────────────────────────────────────────────────
// El Docente puede ver esta lista (para dar seguimiento a lo que solicitó),
// pero solo ve SUS PROPIAS solicitudes — Staff (Secretaría/Dirección/Admin)
// ve todas las del colegio, que es lo que necesitan para gestionarlas.
router.get('/', isDocente, async (req, res) => {
  const { estado, fecha, page = '1', limit = '50' } = req.query as Record<string,string>;
  const where: any = { colegioId: req.colegioId! };
  if (estado) where.estado = estado as PermisoSalidaEstado;
  if (fecha)  where.fechaSolicitud = { gte: new Date(fecha), lte: new Date(new Date(fecha).setHours(23,59,59)) };
  if (!esStaffReq(req)) where.solicitadoPorId = req.user!.id;

  const [total, permisos] = await Promise.all([
    prisma.permisoSalida.count({ where }),
    prisma.permisoSalida.findMany({
      where,
      skip: (parseInt(page)-1)*parseInt(limit),
      take: parseInt(limit),
      orderBy: { fechaSolicitud: 'desc' },
      include: {
        estudiante:   { select: { nombres: true, apellidos: true, fotoUrl: true } },
        solicitadoPor:{ select: { nombres: true, apellidos: true, rol: true } },
        validadoPor:  { select: { nombres: true, apellidos: true } },
        autorizadoPor:{ select: { nombres: true, apellidos: true } },
      },
    }),
  ]);
  res.json({ ok: true, data: permisos, meta: { total } });
});

// ── GET /permisos/:id ─────────────────────────────────────────────────────────
router.get('/:id', isDocente, async (req, res) => {
  const where: any = { id: req.params.id, colegioId: req.colegioId! };
  if (!esStaffReq(req)) where.solicitadoPorId = req.user!.id;
  const p = await prisma.permisoSalida.findFirst({
    where,
    include: {
      estudiante:   { include: { padreEstudiantes: { include: { padre: true } } } },
      solicitadoPor:{ select: { nombres: true, apellidos: true, rol: true } },
      validadoPor:  { select: { nombres: true, apellidos: true } },
      autorizadoPor:{ select: { nombres: true, apellidos: true } },
    },
  });
  if (!p) throw new AppError('Permiso no encontrado', 404);
  res.json({ ok: true, data: p });
});

// ── POST /permisos — Docente solicita permiso de salida ───────────────────────
router.post(
  '/',
  isDocente,
  auditar({ modulo: 'PERMISOS_SALIDA', accion: AuditoriaAccion.CREAR }),
  async (req, res) => {
    const data = permisoSchema.parse(req.body);
    // Se listan los campos explícitos en vez de "...data" — al mezclar un
    // objeto parcialmente opcional (el que devuelve zod) con campos extra
    // dentro del mismo literal, TypeScript no logra decidir contra cuál de
    // las dos variantes del tipo de Prisma (CreateInput vs
    // UncheckedCreateInput) debe validar, y termina marcando colegioId como
    // inválido aunque el valor sea correcto en tiempo de ejecución. Nunca
    // se notó en local porque ts-node es más permisivo con esto que un
    // build de producción limpio con tsc.
    const permiso = await prisma.permisoSalida.create({
      data: {
        estudianteId:    data.estudianteId,
        motivo:          data.motivo,
        descripcion:     data.descripcion,
        colegioId:       req.colegioId!,
        solicitadoPorId: req.user!.id,
        estado:          PermisoSalidaEstado.SOLICITADO,
      },
    });
    res.status(201).json({ ok: true, data: permiso });
  },
);

// ── PATCH /permisos/:id/validar — Secretaría valida y confirma llamada al padre
router.patch(
  '/:id/validar',
  isStaff,
  auditar({ modulo: 'PERMISOS_SALIDA', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const { telefonoContactado, llamadaConfirmada } = z.object({
      telefonoContactado: z.string().optional(),
      llamadaConfirmada:  z.boolean().default(false),
    }).parse(req.body);

    const permiso = await prisma.permisoSalida.findFirst({
      where: { id: req.params.id, colegioId: req.colegioId!, estado: PermisoSalidaEstado.SOLICITADO },
    });
    if (!permiso) throw new AppError('Permiso no encontrado o no está en estado SOLICITADO', 404);

    await prisma.permisoSalida.update({
      where: { id: req.params.id },
      data: {
        estado:              PermisoSalidaEstado.VALIDADO,
        validadoPorId:       req.user!.id,
        fechaValidacion:     new Date(),
        llamadaConfirmada,
        telefonoContactado,
      },
    });
    res.json({ ok: true });
  },
);

// ── PATCH /permisos/:id/autorizar — Secretaría autoriza o deniega ─────────────
router.patch(
  '/:id/autorizar',
  isStaff,
  auditar({ modulo: 'PERMISOS_SALIDA', accion: AuditoriaAccion.APROBAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const { autorizado, observaciones } = z.object({
      autorizado:    z.boolean(),
      observaciones: z.string().optional(),
    }).parse(req.body);

    const permiso = await prisma.permisoSalida.findFirst({
      where: { id: req.params.id, colegioId: req.colegioId!, estado: PermisoSalidaEstado.VALIDADO },
      include: {
        estudiante: {
          include: {
            padreEstudiantes: {
              where: { esPrincipal: true },
              include: { padre: { include: { usuario: { select: { fcmToken: true } } } } },
            },
          },
        },
      },
    });
    if (!permiso) throw new AppError('Permiso no encontrado o no está validado', 404);

    const nuevoEstado = autorizado ? PermisoSalidaEstado.AUTORIZADO : PermisoSalidaEstado.DENEGADO;
    await prisma.permisoSalida.update({
      where: { id: req.params.id },
      data: {
        estado:            nuevoEstado,
        autorizadoPorId:   req.user!.id,
        fechaAutorizacion: new Date(),
        observaciones,
        horaSalida:        autorizado ? new Date() : null,
      },
    });

    // Notificar al padre
    const padre = permiso.estudiante.padreEstudiantes[0]?.padre;
    if (padre) {
      const alumno = `${permiso.estudiante.nombres} ${permiso.estudiante.apellidos}`;
      await enviarNotificacion({
        colegioId: req.colegioId!,
        padreId:   padre.id,
        tipo:      'PERMISO',
        titulo:    autorizado ? `✅ Permiso de salida autorizado` : `❌ Permiso de salida denegado`,
        cuerpo:    `${alumno}: ${permiso.motivo}${observaciones ? ` — ${observaciones}` : ''}`,
        fcmToken:  padre.usuario?.fcmToken ?? undefined,
      });
    }
    res.json({ ok: true, estado: nuevoEstado });
  },
);

// ── PATCH /permisos/:id/ejecutar — El Director da la aprobación final y se ───
// registra que el estudiante salió. Deliberadamente más restringido que
// isStaff: Secretaría gestiona la solicitud y la llamada, pero la salida
// efectiva del alumno la aprueba Dirección (o Administración/SuperAdmin).
router.patch(
  '/:id/ejecutar',
  isAdminDir,
  auditar({ modulo: 'PERMISOS_SALIDA', accion: AuditoriaAccion.APROBAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const permiso = await prisma.permisoSalida.findFirst({ where: { id: req.params.id, colegioId: req.colegioId!, estado: PermisoSalidaEstado.AUTORIZADO } });
    if (!permiso) throw new AppError('Permiso no encontrado o no está autorizado', 404);
    await prisma.permisoSalida.update({
      where: { id: req.params.id },
      data: { estado: PermisoSalidaEstado.EJECUTADO, horaSalida: new Date() },
    });
    res.json({ ok: true });
  },
);

export default router;
