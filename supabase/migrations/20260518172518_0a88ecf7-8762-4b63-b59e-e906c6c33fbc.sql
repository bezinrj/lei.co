CREATE POLICY "Users can create own personal cronogramas"
ON public.cronogramas
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = criado_por
  AND auth.uid() = created_by
  AND is_proprio = true
  AND categoria = 'Cronograma Pessoal'
  AND premium = false
);

CREATE POLICY "Users can upload own cronograma covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cronogramas-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);