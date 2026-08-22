-- SIGE v8.7 — Migración incremental (ejecutar en Supabase SQL Editor)
-- Aditiva: no borra datos existentes.

-- 1. Aula: docente tutor asignable
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS "docenteTutorId" TEXT;
ALTER TABLE aulas ADD CONSTRAINT "aulas_docenteTutorId_fkey"
  FOREIGN KEY ("docenteTutorId") REFERENCES usuarios(id) ON DELETE SET NULL;

-- 2. Horario: bloque especial de RECREO
DO $$ BEGIN
  CREATE TYPE "TipoBloque" AS ENUM ('CLASE','RECREO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
ALTER TABLE horarios ADD COLUMN IF NOT EXISTS "tipoBloque" "TipoBloque" NOT NULL DEFAULT 'CLASE';
