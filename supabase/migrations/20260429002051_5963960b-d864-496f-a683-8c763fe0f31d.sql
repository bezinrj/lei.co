INSERT INTO storage.buckets (id, name, public) VALUES ('grupos-fotos', 'grupos-fotos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Grupos fotos publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'grupos-fotos');

CREATE POLICY "Authenticated upload grupos fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'grupos-fotos');

CREATE POLICY "Owners update grupos fotos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'grupos-fotos' AND owner = auth.uid());

CREATE POLICY "Owners delete grupos fotos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'grupos-fotos' AND owner = auth.uid());