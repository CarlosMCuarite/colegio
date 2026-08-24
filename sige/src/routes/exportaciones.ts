// src/routes/exportaciones.ts
import { Router } from 'express';
import { z } from 'zod';
import archiver from 'archiver';
import prisma from '../config/prisma';
import { authenticate, isAdminDir } from '../middleware/auth';
import { resolveTenant, requireTenant } from '../middleware/tenant';
import { auditar } from '../middleware/auditoria';
import { AuditoriaAccion, Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate, resolveTenant, requireTenant, isAdminDir);

const MODULOS_DISPONIBLES = [
  'estudiantes', 'padres', 'matriculas',
  'asistencias', 'pagos', 'eventos', 'comunicados',
] as const;

type Modulo = (typeof MODULOS_DISPONIBLES)[number];

// ─── POST /exportaciones ──────────────────────────────────────────────────────
// Genera y descarga un ZIP con los JSONs de los módulos solicitados
router.post(
  '/',
  auditar({ modulo: 'EXPORTACIONES', accion: AuditoriaAccion.EXPORTAR }),
  async (req, res) => {
    const schema = z.object({
      modulos: z.array(z.enum(MODULOS_DISPONIBLES)).min(1),
    });
    const { modulos } = schema.parse(req.body);
    const colegioId = req.colegioId!;

    // Registrar exportación en BD
    const exportacion = await prisma.exportacion.create({
      data: {
        colegioId,
        usuarioId: req.user!.id,
        nombre:    `exportacion-${new Date().toISOString().slice(0, 10)}`,
        modulos,
        estado:    'EN_PROCESO',
      } as Prisma.ExportacionUncheckedCreateInput,
    });

    try {
      // Construir nombre de archivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const zipNombre = `sige-exportacion-${timestamp}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipNombre}"`);

      const zip = archiver('zip', { zlib: { level: 9 } });
      zip.pipe(res);

      // Exportar cada módulo solicitado (solo lectura)
      for (const modulo of modulos) {
        const data = await exportarModulo(modulo, colegioId);
        zip.append(JSON.stringify(data, null, 2), { name: `${modulo}.json` });
      }

      // Metadatos
      zip.append(JSON.stringify({
        colegio:    colegioId,
        generadoPor: req.user!.id,
        fecha:       new Date().toISOString(),
        modulos,
        version:     '1.0',
        modo:        'SOLO_LECTURA — No reinsertar datos directamente',
      }, null, 2), { name: 'meta.json' });

      await zip.finalize();

      await prisma.exportacion.update({
        where: { id: exportacion.id },
        data: { estado: 'COMPLETADO', nombre: zipNombre },
      });
    } catch (err) {
      await prisma.exportacion.update({
        where: { id: exportacion.id },
        data: { estado: 'ERROR', error: (err as Error).message },
      });
      throw err;
    }
  },
);

// ─── GET /exportaciones ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const exportaciones = await prisma.exportacion.findMany({
    where: { colegioId: req.colegioId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { usuario: { select: { nombres: true, apellidos: true } } },
  });
  res.json({ ok: true, data: exportaciones });
});

// ─── Helper: exportar módulo ──────────────────────────────────────────────────
async function exportarModulo(modulo: Modulo, colegioId: string): Promise<unknown> {
  switch (modulo) {
    case 'estudiantes':
      return prisma.estudiante.findMany({ where: { colegioId } });
    case 'padres':
      return prisma.padre.findMany({ where: { colegioId } });
    case 'matriculas':
      return prisma.matricula.findMany({ where: { colegioId } });
    case 'asistencias':
      return prisma.asistencia.findMany({ where: { colegioId }, orderBy: { fecha: 'desc' } });
    case 'pagos':
      return prisma.pago.findMany({ where: { colegioId } });
    case 'eventos':
      return prisma.evento.findMany({ where: { colegioId } });
    case 'comunicados':
      return prisma.comunicado.findMany({ where: { colegioId } });
    default:
      return [];
  }
}

export default router;
