
-- 1. Prevent role escalation in grupo_membros: only fundador (or admin) can change role
CREATE OR REPLACE FUNCTION public.prevent_grupo_membros_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (public.is_grupo_fundador(NEW.grupo_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
      RAISE EXCEPTION 'Apenas o fundador do grupo pode alterar o papel de um membro';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_grupo_membros_role_escalation ON public.grupo_membros;
CREATE TRIGGER trg_prevent_grupo_membros_role_escalation
BEFORE UPDATE ON public.grupo_membros
FOR EACH ROW
EXECUTE FUNCTION public.prevent_grupo_membros_role_escalation();

-- 2. Restrict badge inserts: remove self-insert, require admin (server uses service_role which bypasses RLS)
DROP POLICY IF EXISTS "User inserts own badges" ON public.user_badges;

CREATE POLICY "Admins insert badges"
ON public.user_badges
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Allow users to delete their own cronograma cover files (folder prefix = uid)
CREATE POLICY "Users can delete own cronograma covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cronogramas-covers'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
