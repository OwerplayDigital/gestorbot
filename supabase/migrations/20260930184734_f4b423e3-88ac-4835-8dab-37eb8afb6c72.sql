ALTER TABLE public.templates_whatsapp ADD COLUMN IF NOT EXISTS imagem_url text;
DROP POLICY IF EXISTS "template_images_authenticated_insert" ON storage.objects;
CREATE POLICY "template_images_authenticated_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'template-images');
DROP POLICY IF EXISTS "template_images_authenticated_update" ON storage.objects;
CREATE POLICY "template_images_authenticated_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'template-images') WITH CHECK (bucket_id = 'template-images');
DROP POLICY IF EXISTS "template_images_authenticated_delete" ON storage.objects;
CREATE POLICY "template_images_authenticated_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'template-images');
DROP POLICY IF EXISTS "template_images_authenticated_read" ON storage.objects;
CREATE POLICY "template_images_authenticated_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'template-images');