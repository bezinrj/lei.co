
-- Owner of a personal cronograma (is_proprio = true, criado_por = auth.uid())
-- can manage its matérias and tópicos.

-- cronograma_materias
CREATE POLICY "Owner manage materias of own cronograma (insert)"
ON public.cronograma_materias
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cronogramas c
    WHERE c.id = cronograma_materias.cronograma_id
      AND c.is_proprio = true
      AND c.criado_por = auth.uid()
  )
);

CREATE POLICY "Owner manage materias of own cronograma (update)"
ON public.cronograma_materias
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cronogramas c
    WHERE c.id = cronograma_materias.cronograma_id
      AND c.is_proprio = true
      AND c.criado_por = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cronogramas c
    WHERE c.id = cronograma_materias.cronograma_id
      AND c.is_proprio = true
      AND c.criado_por = auth.uid()
  )
);

CREATE POLICY "Owner manage materias of own cronograma (delete)"
ON public.cronograma_materias
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cronogramas c
    WHERE c.id = cronograma_materias.cronograma_id
      AND c.is_proprio = true
      AND c.criado_por = auth.uid()
  )
);

-- cronograma_topicos
CREATE POLICY "Owner manage topicos of own cronograma (insert)"
ON public.cronograma_topicos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.cronograma_materias m
    JOIN public.cronogramas c ON c.id = m.cronograma_id
    WHERE m.id = cronograma_topicos.materia_id
      AND c.is_proprio = true
      AND c.criado_por = auth.uid()
  )
);

CREATE POLICY "Owner manage topicos of own cronograma (update)"
ON public.cronograma_topicos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cronograma_materias m
    JOIN public.cronogramas c ON c.id = m.cronograma_id
    WHERE m.id = cronograma_topicos.materia_id
      AND c.is_proprio = true
      AND c.criado_por = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.cronograma_materias m
    JOIN public.cronogramas c ON c.id = m.cronograma_id
    WHERE m.id = cronograma_topicos.materia_id
      AND c.is_proprio = true
      AND c.criado_por = auth.uid()
  )
);

CREATE POLICY "Owner manage topicos of own cronograma (delete)"
ON public.cronograma_topicos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cronograma_materias m
    JOIN public.cronogramas c ON c.id = m.cronograma_id
    WHERE m.id = cronograma_topicos.materia_id
      AND c.is_proprio = true
      AND c.criado_por = auth.uid()
  )
);
