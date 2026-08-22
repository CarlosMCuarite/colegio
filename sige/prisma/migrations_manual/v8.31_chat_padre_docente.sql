-- v8.31: Chat directo Padre ↔ Docente.
-- Corre esto en el SQL Editor de Supabase, luego reinicia el backend.

CREATE TABLE IF NOT EXISTS "conversaciones" (
  "id" TEXT NOT NULL,
  "colegioId" TEXT NOT NULL,
  "padreUsuarioId" TEXT NOT NULL,
  "docenteUsuarioId" TEXT NOT NULL,
  "estudianteId" TEXT NOT NULL,
  "ultimoMensajeEn" TIMESTAMP(3),
  "ultimoMensajeTexto" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversaciones_padreUsuarioId_docenteUsuarioId_estudianteId_key" ON "conversaciones"("padreUsuarioId", "docenteUsuarioId", "estudianteId");
CREATE INDEX IF NOT EXISTS "conversaciones_colegioId_idx" ON "conversaciones"("colegioId");
CREATE INDEX IF NOT EXISTS "conversaciones_padreUsuarioId_idx" ON "conversaciones"("padreUsuarioId");
CREATE INDEX IF NOT EXISTS "conversaciones_docenteUsuarioId_idx" ON "conversaciones"("docenteUsuarioId");
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "colegios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_padreUsuarioId_fkey" FOREIGN KEY ("padreUsuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_docenteUsuarioId_fkey" FOREIGN KEY ("docenteUsuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "mensajes" (
  "id" TEXT NOT NULL,
  "conversacionId" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "contenido" TEXT NOT NULL,
  "leidoEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mensajes_conversacionId_idx" ON "mensajes"("conversacionId");
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nuevo valor de enum para notificar mensajes de chat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'MENSAJE'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificacionTipo')
  ) THEN
    ALTER TYPE "NotificacionTipo" ADD VALUE 'MENSAJE';
  END IF;
END $$;
