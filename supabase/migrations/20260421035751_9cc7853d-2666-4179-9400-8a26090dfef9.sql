DROP POLICY IF EXISTS "Cronogramas viewable by authenticated" ON public.cronogramas;

CREATE POLICY "Cronogramas viewable by allowed users"
ON public.cronogramas
FOR SELECT
TO authenticated
USING (
  is_proprio = false
  OR criado_por = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderador'::public.app_role)
);