-- v8.10: horario de asistencia configurable por colegio (usado por QR)
-- Nota: el modelo Prisma "Colegio" está mapeado a la tabla "colegios" (@@map).
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "horaEntrada"  TEXT DEFAULT '07:30';
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "horaTardanza" TEXT DEFAULT '08:00';
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "horaSalida"   TEXT DEFAULT '13:00';
