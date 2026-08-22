-- SIGE v8.2 — Migración incremental (ejecutar en Supabase SQL Editor)
-- Aditiva: no borra datos existentes.

-- 1. Horario: asignación real de docente y aula
ALTER TABLE horarios ADD COLUMN IF NOT EXISTS "aulaId" TEXT;
ALTER TABLE horarios ADD COLUMN IF NOT EXISTS "docenteId" TEXT;
ALTER TABLE horarios ADD CONSTRAINT "horarios_aulaId_fkey"
  FOREIGN KEY ("aulaId") REFERENCES aulas(id) ON DELETE SET NULL;
ALTER TABLE horarios ADD CONSTRAINT "horarios_docenteId_fkey"
  FOREIGN KEY ("docenteId") REFERENCES usuarios(id) ON DELETE SET NULL;

-- 2. PadreEstudiante: flujo de solicitud/aprobación de vínculo
DO $$ BEGIN
  CREATE TYPE "VinculoEstado" AS ENUM ('PENDIENTE','APROBADO','RECHAZADO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE padre_estudiantes ADD COLUMN IF NOT EXISTS "estado" "VinculoEstado" NOT NULL DEFAULT 'APROBADO';
ALTER TABLE padre_estudiantes ADD COLUMN IF NOT EXISTS "aprobadoPorId" TEXT;

-- 3. Nuevas acciones de auditoría (ya usadas por versiones previas de padres/licencias)
ALTER TYPE "AuditoriaAccion" ADD VALUE IF NOT EXISTS 'APROBAR';
ALTER TYPE "AuditoriaAccion" ADD VALUE IF NOT EXISTS 'RECHAZAR';
