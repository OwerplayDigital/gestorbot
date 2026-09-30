-- Suporte opcional a imagens nos templates de WhatsApp
ALTER TABLE public.templates_whatsapp
  ADD COLUMN IF NOT EXISTS imagem_url text;

-- Bucket público: as artes são materiais enviados ao WhatsApp e precisam de URL acessível.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-images',
  'template-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "template_images_authenticated_insert" ON storage.objects;
CREATE POLICY "template_images_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'template-images');

DROP POLICY IF EXISTS "template_images_authenticated_update" ON storage.objects;
CREATE POLICY "template_images_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'template-images')
WITH CHECK (bucket_id = 'template-images');

DROP POLICY IF EXISTS "template_images_authenticated_delete" ON storage.objects;
CREATE POLICY "template_images_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'template-images');

DROP POLICY IF EXISTS "template_images_public_read" ON storage.objects;
CREATE POLICY "template_images_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'template-images');
