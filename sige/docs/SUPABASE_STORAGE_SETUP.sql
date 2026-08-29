-- EJECUTAR EN SUPABASE → SQL EDITOR
-- Configura los buckets de Storage y sus policies para SIGE

-- ── Crear buckets si no existen ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES
  ('logos',       'logos',       true,  false, 5242880,  ARRAY['image/png','image/jpeg','image/jpg','image/webp']),
  ('vales',       'vales',       false, false, 10485760, ARRAY['image/png','image/jpeg','image/jpg','image/webp','application/pdf']),
  -- Documentos y adjuntos son privados. El backend entrega URLs firmadas de
  -- corta duración solo después de validar tenant, rol y destinatario.
  ('documentos',  'documentos',  false, false, 20971520, ARRAY['image/png','image/jpeg','image/webp','application/pdf']),
  ('avatares',    'avatares',    true,  false, 3145728,  ARRAY['image/png','image/jpeg','image/jpg','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- ── Eliminar policies antiguas si existen ─────────────────────────────────────
DROP POLICY IF EXISTS "logos_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_update"   ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_delete"   ON storage.objects;
DROP POLICY IF EXISTS "avatares_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatares_auth_insert" ON storage.objects;

-- ── Policies para bucket LOGOS (público para lectura, autenticado para escritura) ─
CREATE POLICY "logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "logos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "logos_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "logos_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- ── Policies para bucket AVATARES ─────────────────────────────────────────────
CREATE POLICY "avatares_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatares');

CREATE POLICY "avatares_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatares' AND auth.role() = 'authenticated');

-- ── Policies para bucket VOUCHERS (solo autenticados) ────────────────────────
DROP POLICY IF EXISTS "vales_auth_all" ON storage.objects;
DROP POLICY IF EXISTS "vouchers_auth_all" ON storage.objects;
CREATE POLICY "vouchers_auth_all" ON storage.objects
  FOR ALL USING (bucket_id = 'vales' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'vales' AND auth.role() = 'authenticated');

-- ── Bucket DOCUMENTOS privado ─────────────────────────────────────────────────
-- Todas las operaciones pasan por supabaseAdmin (service_role), que omite RLS.
-- No se conceden policies al cliente: ni conocer el path permite descargarlo.
DROP POLICY IF EXISTS "documentos_auth_all" ON storage.objects;
DROP POLICY IF EXISTS "documentos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "documentos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_auth_delete" ON storage.objects;


-- ── Bucket BACKUPS (privado — solo service_role, sin policies de cliente) ────
-- Los respaldos NUNCA deben ser públicos ni accesibles por usuarios normales.
-- El backend accede siempre con supabaseAdmin (service_role), que bypasea RLS;
-- por eso este bucket no necesita policies para authenticated/anon.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('backups', 'backups', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

-- ── Verificar que quedaron creados ────────────────────────────────────────────
SELECT id, name, public, file_size_limit FROM storage.buckets ORDER BY name;
