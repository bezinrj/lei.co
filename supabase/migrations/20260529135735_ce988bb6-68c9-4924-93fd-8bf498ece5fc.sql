CREATE POLICY "Staff view all notas"
ON public.user_notas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));