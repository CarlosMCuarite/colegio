// src/routes/colegios.ts — SIGE V8.1
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../config/prisma';
import { authenticate, isSuperAdmin, isAdminDir } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AppError } from '../utils/AppError';
import { AuditoriaAccion, ColegioEstado, RolNombre, Prisma } from '@prisma/client';
import { uploadFile, BUCKETS } from '../services/storageService';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../utils/logger';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(authenticate, resolveTenant);

function slugify(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
}
function randomPassword() { return `Sige${Math.random().toString(36).slice(-5).toUpperCase()}!${Math.floor(Math.random()*90+10)}`; }

// Solo campos que existen en Prisma — sin generarUsuarios ni adminEmail
const colegioSchema = z.object({
  nombre:           z.string().min(2),
  nombreCorto:      z.string().optional().nullable(),
  slug:             z.string().optional(),
  ruc:              z.string().optional().nullable(),
  direccion:        z.string().optional().nullable(),
  distrito:         z.string().optional().nullable(),
  provincia:        z.string().optional().nullable(),
  departamento:     z.string().optional().nullable(),
  telefono:         z.string().optional().nullable(),
  email:            z.string().email().optional().nullable(),
  sitioWeb:         z.string().optional().nullable(),
  planId:           z.string().optional(),
  licenciaInicio:   z.string().optional().nullable(),
  licenciaFin:      z.string().optional().nullable(),
  anoEscolarActual: z.coerce.number().int().optional().nullable(),
  whatsappNumero:   z.string().optional().nullable(),
  whatsappHorario:  z.string().optional().nullable(),
  whatsappMensaje:  z.string().optional().nullable(),
  horaEntrada:      z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  horaTardanza:     z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  horaSalida:       z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  yapeNumero:       z.string().optional().nullable(),
  yapeTitular:      z.string().optional().nullable(),
  plinNumero:       z.string().optional().nullable(),
  plinTitular:      z.string().optional().nullable(),
  bancoNombre:      z.string().optional().nullable(),
  cuentaBancaria:   z.string().optional().nullable(),
  cuentaBancariaCCI: z.string().optional().nullable(),
  retencionDatos:   z.enum(['UN_ANIO','DOS_ANIOS','TRES_ANIOS','CINCO_ANIOS','PERMANENTE']).optional(),
  colorPrimario:    z.string().optional().nullable(),
  colorSecundario:  z.string().optional().nullable(),
  historia:         z.string().optional().nullable(),
  mision:           z.string().optional().nullable(),
  vision:           z.string().optional().nullable(),
});

router.get('/', async (req, res) => {
  const user = req.user!;
  if (user.rol === RolNombre.SUPERADMIN) {
    const { q, estado, page = '1', limit = '20' } = req.query as Record<string,string>;
    const where: any = {};
    if (estado) where.estado = estado as ColegioEstado;
    if (q) where.OR = [{ nombre: { contains: q, mode: 'insensitive' } }, { ruc: { contains: q } }, { nombreCorto: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }];
    const [total, colegios] = await Promise.all([
      prisma.colegio.count({ where }),
      prisma.colegio.findMany({ where, skip: (parseInt(page)-1)*parseInt(limit), take: parseInt(limit), orderBy: { createdAt: 'desc' },
        include: { plan: { select: { nombre: true, rolesHabilitados: true } }, _count: { select: { estudiantes: { where: { deletedAt: null } }, usuarios: { where: { activo: true } } } } } }),
    ]);
    return res.json({ ok: true, data: colegios, meta: { total } });
  }
  if (!user.colegioId) throw new AppError('Sin colegio asignado', 404);
  const colegio = await prisma.colegio.findUnique({ where: { id: user.colegioId }, include: { plan: true, _count: { select: { estudiantes: { where: { deletedAt: null } }, usuarios: { where: { activo: true } } } } } });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  return res.json({ ok: true, data: colegio });
});

router.get('/:id', async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
  const colegio = await prisma.colegio.findUnique({ where: { id: req.params.id }, include: { plan: true, _count: { select: { estudiantes: true, usuarios: true, matriculas: true } } } });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  res.json({ ok: true, data: colegio });
});

router.post('/', isSuperAdmin, auditar({ modulo: 'COLEGIOS', accion: AuditoriaAccion.CREAR }), async (req, res) => {
  // Extraer extras del body SIN pasarlos a Prisma
  const { generarUsuarios = true, adminEmail, ...bodyRest } = req.body;
  const data = colegioSchema.parse(bodyRest);
  if (!data.planId) throw new AppError('El plan es requerido', 400);
  const plan = await prisma.plan.findUnique({ where: { id: data.planId } });
  if (!plan) throw new AppError('Plan no encontrado', 404);
  let slug = slugify(data.slug || data.nombre);
  const slugExiste = await prisma.colegio.findUnique({ where: { slug } });
  if (slugExiste) slug = `${slug}-${Date.now().toString(36)}`;
  const licenciaInicio = data.licenciaInicio ? new Date(data.licenciaInicio) : new Date();
  const licenciaFin    = data.licenciaFin    ? new Date(data.licenciaFin)    : new Date(Date.now() + plan.duracionDias * 86400000);

  const colegio = await prisma.colegio.create({
    data: { nombre: data.nombre, nombreCorto: data.nombreCorto, slug, ruc: data.ruc, direccion: data.direccion, distrito: data.distrito, provincia: data.provincia, departamento: data.departamento, telefono: data.telefono, email: data.email, sitioWeb: data.sitioWeb, planId: data.planId, estado: ColegioEstado.ACTIVO, licenciaInicio, licenciaFin, anoEscolarActual: data.anoEscolarActual, whatsappNumero: data.whatsappNumero, whatsappHorario: data.whatsappHorario, whatsappMensaje: data.whatsappMensaje, colorPrimario: data.colorPrimario, colorSecundario: data.colorSecundario, historia: data.historia, mision: data.mision, vision: data.vision },
  });

  await prisma.licencia.create({ data: { colegioId: colegio.id, planId: plan.id, estado: 'ACTIVA', fechaInicio: licenciaInicio, fechaFin: licenciaFin, motivo: 'Licencia inicial', creadoPorId: req.user!.id } as Prisma.LicenciaUncheckedCreateInput });

  const credencialesGeneradas: Array<{ rol: string; email: string; password: string }> = [];
  const erroresGeneracion: Array<{ rol: string; email: string; error: string }> = [];
  if (generarUsuarios !== false) {
    const base = adminEmail || data.email || `admin@${slug}.sige.pe`;
    const staffDefs = [
      { rol: RolNombre.ADMINISTRADOR, nombres: 'Admin',      apellidos: 'Administrador', email: base },
      { rol: RolNombre.DIRECTOR,      nombres: 'Director',   apellidos: 'General',       email: `director@${slug}.sige.pe` },
      { rol: RolNombre.SECRETARIA,    nombres: 'Secretaria', apellidos: 'General',       email: `secretaria@${slug}.sige.pe` },
    ];
    for (const staff of staffDefs) {
      try {
        const password = randomPassword();
        const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({ email: staff.email, password, email_confirm: true });
        if (error) {
          // Antes esto solo quedaba en el log del servidor (logger.warn) — el
          // SuperAdmin veía el colegio "creado" pero sin ningún aviso de que
          // el staff NO se generó. Ahora el error real se devuelve en la
          // respuesta para que se vea en pantalla (ej. si es la clave de
          // Supabase la que está fallando, se nota de inmediato en vez de
          // parecer un bug silencioso).
          logger.warn(`No se pudo crear ${staff.email}: ${error.message}`);
          erroresGeneracion.push({ rol: staff.rol, email: staff.email, error: error.message });
          continue;
        }
        await prisma.usuario.create({ data: { supabaseId: authData.user.id, colegioId: colegio.id, rol: staff.rol, nombres: staff.nombres, apellidos: staff.apellidos, email: staff.email } });
        credencialesGeneradas.push({ rol: staff.rol, email: staff.email, password });
      } catch (e: any) {
        logger.warn(`Error creando staff ${staff.rol}`, e);
        erroresGeneracion.push({ rol: staff.rol, email: staff.email, error: e?.message ?? 'Error desconocido' });
      }
    }
  }
  res.status(201).json({ ok: true, data: colegio, credenciales: credencialesGeneradas, erroresGeneracion });
});

router.patch('/:id', auditar({ modulo: 'COLEGIOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }), async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
  if (!([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.DIRECTOR] as RolNombre[]).includes(user.rol)) throw new AppError('No tienes permiso para editar los datos del colegio', 403);
  // Eliminar campos no-Prisma antes de parsear
  const { generarUsuarios: _g, adminEmail: _a, ...bodyRest } = req.body;
  const data = colegioSchema.partial().parse(bodyRest);
  let slug: string | undefined;
  if (data.slug) {
    slug = slugify(data.slug);
    const existente = await prisma.colegio.findFirst({ where: { slug, id: { not: req.params.id } } });
    if (existente) throw new AppError('Ese slug ya está en uso', 409);
  }
  const colegio = await prisma.colegio.update({
    where: { id: req.params.id },
    data: { ...data, slug, licenciaInicio: data.licenciaInicio ? new Date(data.licenciaInicio) : undefined, licenciaFin: data.licenciaFin ? new Date(data.licenciaFin) : undefined },
  });
  res.json({ ok: true, data: colegio });
});

// ── Plantilla del carnet de estudiante ────────────────────────────────────────
// Endpoint dedicado (en vez de reusar el PATCH /:id general) porque el PATCH
// general solo permite SUPERADMIN/ADMINISTRADOR/DIRECTOR, y el carnet debe
// poder editarlo también SECRETARIA — pero SECRETARIA no debe poder tocar el
// resto de datos del colegio (nombre, dirección, RUC, etc).
//
// Recorta (clamp) el valor en vez de rechazarlo con .min()/.max() — un solo
// recuadro arrastrado hasta pegar con el borde puede dar, por coma
// flotante, algo como 100.00000004%, y con .min()/.max() eso tira abajo el
// guardado COMPLETO (incluyendo los colores que sí habías cambiado) sin que
// quede claro por qué "no se guardaba nada".
const pct = () => z.number().transform(n => Math.max(0, Math.min(100, n)));

const carnetConfigSchema = z.object({
  colorPrimario:      z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  colorSecundario:    z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  lema:                z.string().max(60).optional(),
  mostrarDireccionEstudiante: z.boolean().optional(),
  mostrarTipoSangre:  z.boolean().optional(),
  mostrarDireccionColegio: z.boolean().optional(),
  mostrarMarcaAgua:   z.boolean().optional(),
  textoMarcaAgua:     z.string().max(20).optional(),
  marcaAguaImagenUrl: z.string().optional().nullable(), // PNG subido por el colegio, convertido a WebP
  marcaAguaOpacidad:  z.number().min(1).max(40).optional(),
  informacionImportante: z.array(z.string().max(140)).max(8).optional(),
  nombreDirector:      z.string().max(80).optional(),
  cargoDirector:       z.string().max(60).optional(),
  firmaImagenUrl:      z.string().optional().nullable(), // foto/escaneo de la firma real, convertida a WebP
  // Posición y tamaño (en %, 0-100) de CADA elemento movible del anverso
  // (foto, datos, qr, gradoBadge, seccionBadge, marcaAgua) y del reverso
  // (datosAdicionales, infoImportante, verificacion, firma). Mapa libre
  // para no tener que tocar el schema cada vez que se agregue un elemento
  // nuevo al editor visual.
  // Se usa .transform() para RECORTAR (clamp) el valor en vez de .min()/.max()
  // — ver comentario de `pct` más arriba.
  layout: z.record(z.object({
    xPct: pct(), yPct: pct(), wPct: pct(), hPct: pct(),
  })).optional().nullable(),
  layoutAtras: z.record(z.object({
    xPct: pct(), yPct: pct(), wPct: pct(), hPct: pct(),
  })).optional().nullable(),
});

router.get('/:id/carnet-config', async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
  const colegio = await prisma.colegio.findUnique({
    where: { id: req.params.id },
    select: { carnetConfig: true, colorPrimario: true, colorSecundario: true, nombre: true, logoUrl: true, direccion: true, telefono: true },
  });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  res.json({
    ok: true,
    data: {
      ...(colegio.carnetConfig as any ?? { colorPrimario: colegio.colorPrimario, colorSecundario: colegio.colorSecundario }),
      // Metadatos del colegio (no se guardan como parte de la plantilla, solo
      // van para que la vista previa muestre el nombre/logo reales sin que
      // el frontend tenga que hacer una segunda petición aparte).
      __colegioNombre: colegio.nombre, __colegioLogoUrl: colegio.logoUrl,
      __colegioDireccion: colegio.direccion, __colegioTelefono: colegio.telefono,
    },
  });
});

router.patch('/:id/carnet-config',
  auditar({ modulo: 'COLEGIOS', accion: AuditoriaAccion.ACTUALIZAR, getRecursoId: r => r.params.id }),
  async (req, res) => {
    const user = req.user!;
    if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
    if (!([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.SECRETARIA] as RolNombre[]).includes(user.rol)) {
      throw new AppError('Solo el administrador o la secretaría del colegio pueden editar la plantilla del carnet', 403);
    }
    const data = carnetConfigSchema.parse(req.body);
    const colegio = await prisma.colegio.update({
      where: { id: req.params.id },
      data: { carnetConfig: data as any },
      select: { carnetConfig: true },
    });
    res.json({ ok: true, data: colegio.carnetConfig });
  },
);

// ── POST /:id/carnet-config/imagen — firma o marca de agua (PNG → WebP) ──────
// Endpoint aparte del PATCH normal porque `carnetConfig` se guarda como un
// solo JSON que el PATCH reemplaza completo — si solo quieres cambiar la
// imagen de la firma sin reenviar todo el formulario, este SÍ hace merge
// (lee lo que ya había guardado y solo actualiza el campo de la imagen).
router.post('/:id/carnet-config/imagen', upload.single('imagen'), async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
  if (!([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR, RolNombre.SECRETARIA] as RolNombre[]).includes(user.rol)) {
    throw new AppError('Solo el administrador o la secretaría del colegio pueden editar la plantilla del carnet', 403);
  }
  const { campo } = z.object({ campo: z.enum(['firmaImagenUrl', 'marcaAguaImagenUrl']) }).parse(req.body);
  if (!req.file) throw new AppError('Imagen requerida', 400);

  const result = await uploadFile(BUCKETS.LOGOS, req.file.buffer, req.file.originalname, req.file.mimetype, `carnet-${req.params.id}`);

  const actual = await prisma.colegio.findUnique({ where: { id: req.params.id }, select: { carnetConfig: true } });
  const nuevoConfig = { ...(actual?.carnetConfig as any ?? {}), [campo]: result.url };
  const colegio = await prisma.colegio.update({
    where: { id: req.params.id },
    data: { carnetConfig: nuevoConfig },
    select: { carnetConfig: true },
  });
  res.json({ ok: true, data: colegio.carnetConfig });
});

// ── POST /:id/pago-qr — QR opcional de Yape/Plin/Banco (lo ven los padres) ────
router.post('/:id/pago-qr', upload.single('imagen'), async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
  if (!([RolNombre.SUPERADMIN, RolNombre.ADMINISTRADOR] as RolNombre[]).includes(user.rol)) throw new AppError('Sin permisos', 403);
  const { tipo } = z.object({ tipo: z.enum(['yape', 'plin', 'banco']) }).parse(req.body);
  if (!req.file) throw new AppError('Imagen requerida', 400);
  const result = await uploadFile(BUCKETS.LOGOS, req.file.buffer, req.file.originalname, req.file.mimetype, req.params.id);
  const campo = tipo === 'yape' ? 'yapeQrUrl' : tipo === 'plin' ? 'plinQrUrl' : 'bancoQrUrl';
  const colegio = await prisma.colegio.update({ where: { id: req.params.id }, data: { [campo]: result.url } });
  res.json({ ok: true, data: colegio });
});

router.post('/:id/logo', isAdminDir, upload.single('logo'), async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
  if (!req.file) throw new AppError('Archivo requerido', 400);
  const result = await uploadFile(BUCKETS.LOGOS, req.file.buffer, req.file.originalname, req.file.mimetype, req.params.id);
  await prisma.colegio.update({ where: { id: req.params.id }, data: { logoUrl: result.url } });
  res.json({ ok: true, logoUrl: result.url });
});

router.post('/:id/portada', isAdminDir, upload.single('portada'), async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
  if (!req.file) throw new AppError('Archivo requerido', 400);
  const result = await uploadFile(BUCKETS.LOGOS, req.file.buffer, req.file.originalname, req.file.mimetype, `${req.params.id}/portada`);
  await prisma.colegio.update({ where: { id: req.params.id }, data: { imagenPortada: result.url } });
  res.json({ ok: true, imagenPortada: result.url });
});

router.post('/:id/galeria', isAdminDir, upload.array('imagenes', 10), async (req, res) => {
  const user = req.user!;
  if (user.rol !== RolNombre.SUPERADMIN && user.colegioId !== req.params.id) throw new AppError('Sin acceso', 403);
  // El tipo "Express.Multer.File" depende de que @types/multer logre
  // aumentar el namespace global de Express — en este entorno de build esa
  // fusión de tipos no está resolviendo (falla con "no exported member
  // Multer"), así que se tipa de forma más simple y directa en su lugar.
  const files = (req.files as Array<{ buffer: Buffer; originalname: string; mimetype: string }>) ?? [];
  if (!files.length) throw new AppError('Archivos requeridos', 400);
  const urls: string[] = [];
  for (const file of files) { const r = await uploadFile(BUCKETS.LOGOS, file.buffer, file.originalname, file.mimetype, `${req.params.id}/galeria`); urls.push(r.url); }
  const c = await prisma.colegio.findUnique({ where: { id: req.params.id } });
  const galeria = [...(c?.galeria ?? []), ...urls];
  await prisma.colegio.update({ where: { id: req.params.id }, data: { galeria } });
  res.json({ ok: true, galeria });
});

router.patch('/:id/estado', isSuperAdmin, auditar({ modulo: 'COLEGIOS', accion: AuditoriaAccion.SUSPENDER, getRecursoId: r => r.params.id }), async (req, res) => {
  const { estado } = z.object({ estado: z.nativeEnum(ColegioEstado) }).parse(req.body);
  await prisma.colegio.update({ where: { id: req.params.id }, data: { estado } });

  // Al suspender/inactivar: invalidar refresh tokens de todos los usuarios del
  // colegio para que no puedan renovar sesión. El acceso ya queda bloqueado de
  // inmediato en el siguiente request gracias al chequeo en el middleware authenticate.
  if (estado === 'SUSPENDIDO' || estado === 'INACTIVO') {
    const usuariosColegio = await prisma.usuario.findMany({ where: { colegioId: req.params.id, activo: true }, select: { supabaseId: true } });
    await Promise.allSettled(usuariosColegio.map(u => supabaseAdmin.auth.admin.signOut(u.supabaseId)));
  }
  res.json({ ok: true });
});

router.patch('/:id/roles-opcionales', isSuperAdmin, async (req, res) => {
  const { rolesOpcionales } = z.object({ rolesOpcionales: z.array(z.string()) }).parse(req.body);
  await prisma.colegio.update({ where: { id: req.params.id }, data: { rolesOpcionales: rolesOpcionales as any } });
  res.json({ ok: true });
});

router.get('/:id/stats', isSuperAdmin, async (req, res) => {
  const [estudiantes, usuarios, pagosAgg] = await Promise.all([
    prisma.estudiante.count({ where: { colegioId: req.params.id, estado: 'ACTIVO', deletedAt: null } }),
    prisma.usuario.count({ where: { colegioId: req.params.id, activo: true } }),
    prisma.pago.aggregate({ where: { colegioId: req.params.id, estado: 'APROBADO' }, _sum: { monto: true } }),
  ]);
  res.json({ ok: true, data: { estudiantes, usuarios, pagosTotal: pagosAgg._sum.monto ?? 0 } });
});

router.post('/:id/soporte-acceso', isSuperAdmin, auditar({ modulo: 'SOPORTE_GLOBAL', accion: AuditoriaAccion.ACCESO_SOPORTE, getRecursoId: r => r.params.id }), async (req, res) => {
  const colegio = await prisma.colegio.findUnique({ where: { id: req.params.id } });
  if (!colegio) throw new AppError('Colegio no encontrado', 404);
  const adminColegio = await prisma.usuario.findFirst({ where: { colegioId: colegio.id, rol: RolNombre.ADMINISTRADOR, activo: true } });
  if (!adminColegio) throw new AppError('Este colegio no tiene un administrador activo', 404);
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: adminColegio.email });
  if (error) throw new AppError(`No se pudo generar acceso: ${error.message}`, 500);
  res.json({ ok: true, data: { colegio: { id: colegio.id, nombre: colegio.nombre, slug: colegio.slug }, adminEmail: adminColegio.email, actionLink: data.properties?.action_link } });
});

export default router;
