-- Ejecutar una sola vez en Supabase SQL Editor antes de desplegar.
ALTER TABLE "comunicados" ADD COLUMN IF NOT EXISTS "notificadoEn" TIMESTAMP(3);
-- No reenviar avisos históricos al activar el programador.
UPDATE "comunicados" SET "notificadoEn" = COALESCE("publicadoEn", "createdAt")
WHERE "notificadoEn" IS NULL AND ("publicadoEn" IS NULL OR "publicadoEn" <= CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS "comunicado_adjuntos" (
  "id" TEXT PRIMARY KEY,
  "comunicadoId" TEXT NOT NULL REFERENCES "comunicados"("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "mimeType" TEXT,
  "tamano" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "comunicado_adjuntos_comunicadoId_idx" ON "comunicado_adjuntos"("comunicadoId");

CREATE TABLE IF NOT EXISTS "comunicado_lecturas" (
  "id" TEXT PRIMARY KEY,
  "comunicadoId" TEXT NOT NULL REFERENCES "comunicados"("id") ON DELETE CASCADE,
  "usuarioId" TEXT NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
  "leidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comunicado_lecturas_comunicadoId_usuarioId_key" UNIQUE ("comunicadoId", "usuarioId")
);
CREATE INDEX IF NOT EXISTS "comunicado_lecturas_usuarioId_idx" ON "comunicado_lecturas"("usuarioId");
