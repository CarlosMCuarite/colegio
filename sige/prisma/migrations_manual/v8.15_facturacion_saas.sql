-- v8.15: Facturación del SaaS — pagos de licencia (colegio → plataforma) y
-- configuración global de datos de pago (Yape/Plin/Banco de la plataforma).

CREATE TABLE IF NOT EXISTS "pagos_licencia" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "colegioId"      TEXT NOT NULL REFERENCES "colegios"("id"),
  "licenciaId"     TEXT REFERENCES "licencias"("id"),
  "monto"          DECIMAL(10,2) NOT NULL,
  "moneda"         TEXT NOT NULL DEFAULT 'PEN',
  "periodoPago"    TEXT,
  "estado"         TEXT NOT NULL DEFAULT 'PENDIENTE',
  "banco"          TEXT,
  "operacion"      TEXT,
  "voucherUrl"     TEXT,
  "voucherNombre"  TEXT,
  "fechaPago"      TIMESTAMP,
  "observaciones"  TEXT,
  "aprobadoPorId"  TEXT REFERENCES "usuarios"("id"),
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "pagos_licencia_colegioId_idx" ON "pagos_licencia" ("colegioId");

CREATE TABLE IF NOT EXISTS "configuracion_plataforma" (
  "id"                 TEXT PRIMARY KEY DEFAULT 'global',
  "yapeNumero"         TEXT,
  "yapeTitular"        TEXT,
  "plinNumero"         TEXT,
  "plinTitular"        TEXT,
  "bancoNombre"        TEXT,
  "cuentaBancaria"     TEXT,
  "cuentaBancariaCCI"  TEXT,
  "updatedAt"          TIMESTAMP NOT NULL DEFAULT now()
);
INSERT INTO "configuracion_plataforma" ("id") VALUES ('global') ON CONFLICT DO NOTHING;
