-- SIGE · Analítica académica para tesis
-- Ejecutar una sola vez en Supabase SQL Editor antes de desplegar el backend.
-- Es idempotente y NO elimina ni modifica registros existentes.

ALTER TABLE public.asistencias
  ADD COLUMN IF NOT EXISTS "notificadoEn" timestamptz;

CREATE INDEX IF NOT EXISTS asistencias_colegio_notificado_idx
  ON public.asistencias ("colegioId", "notificadoEn");

CREATE TABLE IF NOT EXISTS public.nota_visualizaciones (
  id text PRIMARY KEY,
  "notaId" text NOT NULL REFERENCES public.notas(id) ON DELETE CASCADE,
  "padreId" text NOT NULL REFERENCES public.padres(id) ON DELETE CASCADE,
  "vistoEn" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nota_visualizaciones_nota_padre_key UNIQUE ("notaId", "padreId")
);

CREATE INDEX IF NOT EXISTS nota_visualizaciones_padre_visto_idx
  ON public.nota_visualizaciones ("padreId", "vistoEn");

CREATE TABLE IF NOT EXISTS public.tesis_lineas_base (
  id text PRIMARY KEY,
  "colegioId" text NOT NULL REFERENCES public.colegios(id) ON DELETE CASCADE,
  indicador text NOT NULL,
  "valorAntes" decimal(14,4) NOT NULL,
  unidad text NOT NULL,
  observaciones text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tesis_lineas_base_colegio_indicador_idx
  ON public.tesis_lineas_base ("colegioId", indicador);
