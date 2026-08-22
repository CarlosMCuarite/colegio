-- v8.20: agrega columnas para QR de pago opcionales (Yape/Plin/Banco), tanto
-- para cada colegio (lo que ve el padre para pagar la pensión) como para la
-- configuración global de la plataforma (lo que ve el Administrador del
-- colegio para pagar su licencia de SIGE al SuperAdmin).
-- Corre esto en el SQL Editor de Supabase SOLO SI todavía no ejecutaste
-- "npx prisma db push" después de actualizar a esta versión.

ALTER TABLE public.colegios
  ADD COLUMN IF NOT EXISTS "yapeQrUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "plinQrUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "bancoQrUrl" TEXT;

ALTER TABLE public.configuracion_plataforma
  ADD COLUMN IF NOT EXISTS "yapeQrUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "plinQrUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "bancoQrUrl" TEXT;
