CREATE TABLE IF NOT EXISTS "metodos_cobro_plataforma" (
  "id" TEXT PRIMARY KEY,
  "nombre" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'OTRO',
  "titular" TEXT,
  "numeroCuenta" TEXT,
  "cci" TEXT,
  "qrUrl" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "metodos_cobro_plataforma_activo_orden_idx"
  ON "metodos_cobro_plataforma" ("activo", "orden");

-- Conserva la configuración anterior migrándola una sola vez.
INSERT INTO "metodos_cobro_plataforma" ("id", "nombre", "tipo", "titular", "numeroCuenta", "qrUrl", "orden", "updatedAt")
SELECT 'legacy-yape', 'Yape', 'BILLETERA', "yapeTitular", "yapeNumero", "yapeQrUrl", 10, CURRENT_TIMESTAMP
FROM "configuracion_plataforma" WHERE "id" = 'global' AND ("yapeNumero" IS NOT NULL OR "yapeQrUrl" IS NOT NULL)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "metodos_cobro_plataforma" ("id", "nombre", "tipo", "titular", "numeroCuenta", "qrUrl", "orden", "updatedAt")
SELECT 'legacy-plin', 'Plin', 'BILLETERA', "plinTitular", "plinNumero", "plinQrUrl", 20, CURRENT_TIMESTAMP
FROM "configuracion_plataforma" WHERE "id" = 'global' AND ("plinNumero" IS NOT NULL OR "plinQrUrl" IS NOT NULL)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "metodos_cobro_plataforma" ("id", "nombre", "tipo", "numeroCuenta", "cci", "qrUrl", "orden", "updatedAt")
SELECT 'legacy-banco', COALESCE("bancoNombre", 'Cuenta bancaria'), 'BANCO', "cuentaBancaria", "cuentaBancariaCCI", "bancoQrUrl", 30, CURRENT_TIMESTAMP
FROM "configuracion_plataforma" WHERE "id" = 'global' AND ("cuentaBancaria" IS NOT NULL OR "bancoQrUrl" IS NOT NULL)
ON CONFLICT ("id") DO NOTHING;
