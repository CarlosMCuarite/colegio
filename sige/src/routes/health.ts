import { Router } from 'express';
import prisma from '../config/prisma';
import { ejecutarBackup } from '../services/backupService';
import { tokenValido } from '../utils/secureToken';

const router = Router();

router.get('/database', async (req, res) => {
  if (!tokenValido(req.header('x-health-token'), process.env.HEALTH_CHECK_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, database: 'available', checkedAt: new Date().toISOString() });
});

router.post('/maintenance', async (req, res) => {
  if (!tokenValido(req.header('x-health-token'), process.env.HEALTH_CHECK_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  await prisma.$queryRaw`SELECT 1`;
  const backup = await ejecutarBackup();
  res.json({ ok: backup.ok, database: 'available', backup, checkedAt: new Date().toISOString() });
});

export default router;
