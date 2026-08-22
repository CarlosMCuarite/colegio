-- v8.18: corrige el tipo de columna de "estado" en las tablas nuevas de
-- Licencia/PagoLicencia (SaaS billing), que quedaron como texto plano en
-- vez del enum de Postgres que Prisma espera.
--
-- Por qué pasa: "prisma db push" a veces no altera el tipo de una columna
-- que ya existía con datos (por seguridad, para no perderlos) y la deja
-- como estaba. Como estas tablas se crearon/editaron a mano en algún punto,
-- la columna "estado" quedó como TEXT en vez de "PagoEstado" /
-- "LicenciaEstado". El resultado es exactamente el error que rompía el
-- dashboard de SuperAdmin:
--   operator does not exist: text = "PagoEstado"
-- porque Prisma arma el WHERE comparando contra el tipo enum, y Postgres
-- no sabe comparar texto plano contra ese tipo sin un cast explícito.
--
-- Este script convierte la columna al enum correcto, mapeando los valores
-- de texto existentes 1:1 (son los mismos nombres). Es seguro correrlo
-- aunque la columna ya sea del tipo correcto (revisa antes de tocar).

DO $$
BEGIN
  -- pagos_licencia.estado → "PagoEstado"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagos_licencia'
      AND column_name = 'estado' AND data_type <> 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.pagos_licencia ALTER COLUMN estado DROP DEFAULT;
    ALTER TABLE public.pagos_licencia
      ALTER COLUMN estado TYPE "PagoEstado" USING estado::text::"PagoEstado";
    ALTER TABLE public.pagos_licencia ALTER COLUMN estado SET DEFAULT 'PENDIENTE';
    RAISE NOTICE 'pagos_licencia.estado convertida a "PagoEstado"';
  ELSE
    RAISE NOTICE 'pagos_licencia.estado ya es el tipo correcto (o no existe la tabla) — nada que hacer';
  END IF;
END $$;

DO $$
BEGIN
  -- licencias.estado → "LicenciaEstado"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'licencias'
      AND column_name = 'estado' AND data_type <> 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.licencias ALTER COLUMN estado DROP DEFAULT;
    ALTER TABLE public.licencias
      ALTER COLUMN estado TYPE "LicenciaEstado" USING estado::text::"LicenciaEstado";
    ALTER TABLE public.licencias ALTER COLUMN estado SET DEFAULT 'PRUEBA';
    RAISE NOTICE 'licencias.estado convertida a "LicenciaEstado"';
  ELSE
    RAISE NOTICE 'licencias.estado ya es el tipo correcto (o no existe la tabla) — nada que hacer';
  END IF;
END $$;

-- Verificación: si esto muestra "USER-DEFINED" en data_type, quedó bien.
SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'estado'
  AND table_name IN ('pagos_licencia', 'licencias')
ORDER BY table_name;
