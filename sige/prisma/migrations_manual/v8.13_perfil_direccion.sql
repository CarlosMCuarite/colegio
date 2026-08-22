-- v8.13: dirección en el perfil de usuario (todos los roles), para que
-- Configuración → Mi Perfil pueda pedir más datos personales.
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "direccion" TEXT;
