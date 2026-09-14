CREATE TABLE IF NOT EXISTS actualizaciones_moviles (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  build INTEGER NOT NULL,
  notas TEXT NOT NULL,
  ruta_archivo TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  tamano_bytes INTEGER NOT NULL,
  obligatoria BOOLEAN NOT NULL DEFAULT FALSE,
  version_minima TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creada_por_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS actualizaciones_moviles_activa_build_idx ON actualizaciones_moviles(activa, build);
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('actualizaciones', 'actualizaciones', false, 52428800, ARRAY['application/vnd.android.package-archive','application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
