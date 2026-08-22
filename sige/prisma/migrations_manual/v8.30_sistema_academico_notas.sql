-- v8.30: Sistema académico — Cursos, Notas por bimestre, Actas/Recuperación.
-- Corre esto en el SQL Editor de Supabase, luego reinicia el backend.
-- (Si vas a usar "npx prisma db push" en vez de este SQL, sáltate este
-- archivo — db push crea todo esto automáticamente a partir del schema.)

-- Enums nuevos
DO $$ BEGIN
  CREATE TYPE "CalificacionLiteral" AS ENUM ('AD', 'A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PeriodoAcademico" AS ENUM ('BIMESTRE_1', 'BIMESTRE_2', 'BIMESTRE_3', 'BIMESTRE_4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla: cursos
CREATE TABLE IF NOT EXISTS "cursos" (
  "id" TEXT NOT NULL,
  "colegioId" TEXT NOT NULL,
  "nivelGradoId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "areaCurricular" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "cursos_colegioId_idx" ON "cursos"("colegioId");
CREATE INDEX IF NOT EXISTS "cursos_nivelGradoId_idx" ON "cursos"("nivelGradoId");
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "colegios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_nivelGradoId_fkey" FOREIGN KEY ("nivelGradoId") REFERENCES "niveles_grados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tabla: notas
CREATE TABLE IF NOT EXISTS "notas" (
  "id" TEXT NOT NULL,
  "colegioId" TEXT NOT NULL,
  "estudianteId" TEXT NOT NULL,
  "cursoId" TEXT NOT NULL,
  "periodo" "PeriodoAcademico" NOT NULL,
  "calificacionLiteral" "CalificacionLiteral",
  "calificacionNumerica" DECIMAL(4,2),
  "observacion" TEXT,
  "registradoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "notas_estudianteId_cursoId_periodo_key" ON "notas"("estudianteId", "cursoId", "periodo");
CREATE INDEX IF NOT EXISTS "notas_colegioId_idx" ON "notas"("colegioId");
CREATE INDEX IF NOT EXISTS "notas_estudianteId_idx" ON "notas"("estudianteId");
CREATE INDEX IF NOT EXISTS "notas_cursoId_idx" ON "notas"("cursoId");
ALTER TABLE "notas" ADD CONSTRAINT "notas_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "colegios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notas" ADD CONSTRAINT "notas_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notas" ADD CONSTRAINT "notas_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notas" ADD CONSTRAINT "notas_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tabla: recuperaciones
CREATE TABLE IF NOT EXISTS "recuperaciones" (
  "id" TEXT NOT NULL,
  "colegioId" TEXT NOT NULL,
  "estudianteId" TEXT NOT NULL,
  "cursoId" TEXT NOT NULL,
  "notaFinal" DECIMAL(4,2),
  "aprobado" BOOLEAN,
  "fechaExamen" TIMESTAMP(3),
  "observacion" TEXT,
  "registradoPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recuperaciones_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "recuperaciones_estudianteId_cursoId_key" ON "recuperaciones"("estudianteId", "cursoId");
CREATE INDEX IF NOT EXISTS "recuperaciones_colegioId_idx" ON "recuperaciones"("colegioId");
ALTER TABLE "recuperaciones" ADD CONSTRAINT "recuperaciones_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "colegios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recuperaciones" ADD CONSTRAINT "recuperaciones_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recuperaciones" ADD CONSTRAINT "recuperaciones_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recuperaciones" ADD CONSTRAINT "recuperaciones_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nuevas columnas en tablas existentes
ALTER TABLE "horarios" ADD COLUMN IF NOT EXISTS "cursoId" TEXT;
CREATE INDEX IF NOT EXISTS "horarios_cursoId_idx" ON "horarios"("cursoId");
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "docente_aulas" ADD COLUMN IF NOT EXISTS "cursoId" TEXT;
CREATE INDEX IF NOT EXISTS "docente_aulas_cursoId_idx" ON "docente_aulas"("cursoId");
ALTER TABLE "docente_aulas" ADD CONSTRAINT "docente_aulas_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
