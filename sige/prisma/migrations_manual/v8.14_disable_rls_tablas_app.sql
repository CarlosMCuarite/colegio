-- v8.14: apaga Row Level Security en las tablas de la aplicación.
--
-- Por qué: estas tablas SOLO las toca el backend (Prisma, con la conexión de
-- DATABASE_URL), nunca el cliente de Supabase desde el navegador. Toda la
-- autorización ya la maneja Express (middlewares de rol/tenant). Si en algún
-- momento se activó RLS en alguna tabla (por ejemplo al crearla desde el
-- Table Editor de Supabase, que la activa por defecto) y esa tabla quedó sin
-- policies para el rol de conexión, cualquier INSERT/UPDATE empieza a fallar
-- con "new row violates row-level security policy" — exactamente el error
-- que rompió los backups. Este script la desactiva en todas las tablas
-- propias para que esto no vuelva a pasar.
--
-- Nota: esto NO afecta las policies de Storage (buckets) — esas son
-- necesarias y quedan igual.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', t);
    EXCEPTION WHEN OTHERS THEN
      -- Si una tabla puntual no se puede alterar (permisos, no existe ya,
      -- etc.), no aborta las demás — antes, un solo error a mitad del loop
      -- revertía TODO el bloque (incluidas las tablas que sí se habían
      -- podido arreglar), que es probablemente por qué "backups" seguía
      -- fallando después de correr este script la primera vez.
      RAISE NOTICE 'No se pudo desactivar RLS en %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- Verificación explícita de la tabla que más problemas dio.
ALTER TABLE IF EXISTS public.backups DISABLE ROW LEVEL SECURITY;
