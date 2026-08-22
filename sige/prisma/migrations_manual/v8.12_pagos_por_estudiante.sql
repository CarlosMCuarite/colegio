-- v8.12: cada Pago ahora se vincula a un estudiante específico (necesario
-- para que hermanos puedan tener montos distintos: descuentos, becas, etc.)
-- y se guarda el monto original + quién lo ajustó, cuando corresponda.

ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "estudianteId"     TEXT;
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "montoOriginal"    DECIMAL(10,2);
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "montoAjustadoPor" TEXT;
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "motivoAjuste"     TEXT;

DO $$ BEGIN
  ALTER TABLE "pagos"
    ADD CONSTRAINT "pagos_estudianteId_fkey"
    FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "pagos_estudianteId_idx" ON "pagos" ("estudianteId");
