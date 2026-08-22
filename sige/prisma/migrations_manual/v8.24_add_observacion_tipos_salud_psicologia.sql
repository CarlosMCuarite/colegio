-- v8.24: agrega dos valores nuevos al enum ObservacionTipo — SALUD (para los
-- registros de Enfermería) y PSICOLOGICA (para los registros de Psicología).
-- Reutiliza la tabla "observaciones" que ya existía (misma tabla, solo un
-- tipo distinto) en vez de crear tablas nuevas.
-- Corre esto en el SQL Editor de Supabase SOLO SI todavía no ejecutaste
-- "npx prisma db push" después de actualizar a esta versión.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'SALUD'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ObservacionTipo')
  ) THEN
    ALTER TYPE "ObservacionTipo" ADD VALUE 'SALUD';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'PSICOLOGICA'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ObservacionTipo')
  ) THEN
    ALTER TYPE "ObservacionTipo" ADD VALUE 'PSICOLOGICA';
  END IF;
END $$;
