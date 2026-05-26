CREATE POLICY "Owner update own personal cronograma" ON public.cronogramas FOR UPDATE TO authenticated USING (is_proprio = true AND criado_por = auth.uid()) WITH CHECK (is_proprio = true AND criado_por = auth.uid());

CREATE POLICY "Owner delete own personal cronograma" ON public.cronogramas FOR DELETE TO authenticated USING (is_proprio = true AND criado_por = auth.uid());

CREATE POLICY "Users can update own cronograma covers" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cronogramas-covers' AND (auth.uid())::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'cronogramas-covers' AND (auth.uid())::text = (storage.foldername(name))[1]);