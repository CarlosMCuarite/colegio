-- v8.11: datos de pago (Yape/Plin/banco) del colegio + plan de pensiones
-- configurable por nivel y meses en ConceptoPago.
-- Nota: los nombres de tabla reales son los del @@map en schema.prisma
-- ("colegios", "conceptos_pago"), no los nombres de los modelos de Prisma.

ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "yapeNumero"        TEXT;
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "yapeTitular"       TEXT;
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "plinNumero"        TEXT;
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "plinTitular"       TEXT;
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "bancoNombre"       TEXT;
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "cuentaBancaria"    TEXT;
ALTER TABLE "colegios" ADD COLUMN IF NOT EXISTS "cuentaBancariaCCI" TEXT;

ALTER TABLE "conceptos_pago" ADD COLUMN IF NOT EXISTS "nivelAplicable"  "NivelEducativo";
ALTER TABLE "conceptos_pago" ADD COLUMN IF NOT EXISTS "mesesAplicables" INTEGER[] DEFAULT ARRAY[3,4,5,6,7,8,9,10,11,12];
