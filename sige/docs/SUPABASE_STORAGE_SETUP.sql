-- EJECUTAR EN SUPABASE → SQL EDITOR
-- Configura los buckets de Storage y sus policies para SIGE

-- ── Crear buckets si no existen ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES
  ('logos',       'logos',       true,  false, 5242880,  ARRAY['image/png','image/jpeg','image/jpg','image/webp']),
  ('vouchers',    'vouchers',    false, false, 5242880,  ARRAY['image/png','image/jpeg','image/jpg','image/webp','application/pdf']),
  -- IMPORTANTE: "documentos" debe ser público=true. El backend genera las URLs
  -- con getPublicUrl(), que arma un link /object/public/... — ese endpoint sólo
  -- funciona si la bandera "public" del bucket está en true; las policies de
  -- abajo NO alcanzan para habilitarlo por sí solas. Con public=false, la URL
  -- devuelta "existe" pero al abrirla da error (por eso el <img> mostraba el
  -- texto alternativo "Adjunto" en vez de la imagen, y el enlace de descarga
  -- fallaba). Igual se agregan las policies para dejar el acceso ordenado.
  ('documentos',  'documentos',  true,  false, 10485760, ARRAY['image/png','image/jpeg','image/webp','application/pdf']),
  ('avatares',    'avatares',    true,  false, 2097152,  ARRAY['image/png','image/jpeg','image/jpg','image/webp'])
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
  FOR ALL USING (bucket_id = 'vouchers' AND auth.role() = 'authenticated');

-- ── Policies para bucket DOCUMENTOS ──────────────────────────────────────────
-- Lectura pública: la app muestra estos archivos con una URL directa
-- (getPublicUrl), sin sesión de Supabase en el navegador — restringir SELECT
-- a "authenticated" aquí causaba que el visor de Comunicados mostrara
-- "Bucket not found" al intentar ver el adjunto. Escritura sigue restringida.
DROP POLICY IF EXISTS "documentos_auth_all" ON storage.objects;
DROP POLICY IF EXISTS "documentos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "documentos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_auth_delete" ON storage.objects;

CREATE POLICY "documentos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'documentos');
CREATE POLICY "documentos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documentos' AND auth.role() = 'authenticated');
CREATE POLICY "documentos_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documentos' AND auth.role() = 'authenticated');
CREATE POLICY "documentos_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'documentos' AND auth.role() = 'authenticated');

-- ── Bucket BACKUPS (privado — solo service_role, sin policies de cliente) ────
-- Los respaldos NUNCA deben ser públicos ni accesibles por usuarios normales.
-- El backend accede siempre con supabaseAdmin (service_role), que bypasea RLS;
-- por eso este bucket no necesita policies para authenticated/anon.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('backups', 'backups', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

-- ── Verificar que quedaron creados ────────────────────────────────────────────
SELECT id, name, public, file_size_limit FROM storage.buckets ORDER BY name;
