DROP POLICY IF EXISTS "Cronogramas viewable by allowed users" ON public.cronogramas;

CREATE POLICY "Cronogramas viewable by allowed users"
ON public.cronogramas
FOR SELECT
TO authenticated
USING (
  (is_proprio = false AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role) OR true))
  OR (is_proprio = true AND criado_por = auth.uid())
);