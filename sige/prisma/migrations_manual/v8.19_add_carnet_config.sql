-- v8.19: agrega la columna carnetConfig (plantilla editable del carnet de
-- estudiante) a la tabla colegios. Corre esto en el SQL Editor de Supabase
-- SOLO SI todavía no ejecutaste "npx prisma db push" en el backend después
-- de actualizar a esta versión — si ya corriste db push, esta columna ya
-- existe y este script no hace nada (es seguro re-ejecutarlo).

ALTER TABLE public.colegios
  ADD COLUMN IF NOT EXISTS "carnetConfig" JSONB;
