-- 1) Gate SELECT on cronograma_materias and cronograma_topicos by access to parent cronograma
DROP POLICY IF EXISTS "Materias viewable by authenticated" ON public.cronograma_materias;
DROP POLICY IF EXISTS "Topicos viewable by authenticated" ON public.cronograma_topicos;

CREATE POLICY "Materias viewable by allowed users"
ON public.cronograma_materias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cronogramas c
    WHERE c.id = cronograma_materias.cronograma_id
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'moderador'::app_role)
        OR c.criado_por = auth.uid()
        OR c.premium = false
        OR public.tem_acesso_cronograma(auth.uid(), c.id)
      )
  )
);

CREATE POLICY "Topicos viewable by allowed users"
ON public.cronograma_topicos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cronograma_materias m
    JOIN public.cronogramas c ON c.id = m.cronograma_id
    WHERE m.id = cronograma_topicos.materia_id
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'moderador'::app_role)
        OR c.criado_por = auth.uid()
        OR c.premium = false
        OR public.tem_acesso_cronograma(auth.uid(), c.id)
      )
  )
);

-- 2) Prevent privilege escalation on user_plans: block user-facing INSERT/UPDATE.
-- Plan grants must be performed via server-side webhooks using the service role.
DROP POLICY IF EXISTS "User inserts own plan" ON public.user_plans;
DROP POLICY IF EXISTS "User updates own plan" ON public.user_plans;

-- 3) Allow admins/moderators to read group activity feed for moderation
DROP POLICY IF EXISTS atividades_select_membros ON public.grupo_atividades;
CREATE POLICY atividades_select_membros_or_staff
ON public.grupo_atividades
FOR SELECT
TO authenticated
USING (
  is_grupo_membro(grupo_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'moderador'::app_role)
);