
-- 1. Add origem_id column to cronogramas
ALTER TABLE public.cronogramas ADD COLUMN IF NOT EXISTS origem_id uuid REFERENCES public.cronogramas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cronogramas_origem_criado ON public.cronogramas(origem_id, criado_por);

-- 2. Clone function
CREATE OR REPLACE FUNCTION public.clonar_cronograma_para_usuario(_cronograma_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _origem RECORD;
  _nova_id uuid;
  _materia RECORD;
  _nova_materia_id uuid;
BEGIN
  -- Idempotência: já existe cópia?
  SELECT id INTO _nova_id FROM public.cronogramas
   WHERE origem_id = _cronograma_id AND criado_por = _user_id
   LIMIT 1;
  IF _nova_id IS NOT NULL THEN RETURN _nova_id; END IF;

  -- Carrega original (precisa ser premium e não-próprio)
  SELECT * INTO _origem FROM public.cronogramas
   WHERE id = _cronograma_id AND is_proprio = false AND premium = true;
  IF _origem.id IS NULL THEN RETURN NULL; END IF;

  -- Cria cópia
  INSERT INTO public.cronogramas
    (nome, categoria, imagem_url, premium, is_proprio, criado_por, created_by, origem_id, preco_centavos, stripe_price_id)
  VALUES
    (_origem.nome, COALESCE(_origem.categoria, 'Premium'), _origem.imagem_url, false, true, _user_id, _user_id, _origem.id, NULL, NULL)
  RETURNING id INTO _nova_id;

  -- Copia matérias + tópicos
  FOR _materia IN SELECT * FROM public.cronograma_materias WHERE cronograma_id = _origem.id ORDER BY ordem LOOP
    INSERT INTO public.cronograma_materias (cronograma_id, nome, ordem, cor)
    VALUES (_nova_id, _materia.nome, _materia.ordem, _materia.cor)
    RETURNING id INTO _nova_materia_id;

    INSERT INTO public.cronograma_topicos
      (materia_id, titulo, descricao, assunto, atencao, doutrina, fontes, horas_estimadas, duracao_minutos, ordem)
    SELECT _nova_materia_id, titulo, descricao, assunto, atencao, doutrina, fontes, horas_estimadas, duracao_minutos, ordem
    FROM public.cronograma_topicos WHERE materia_id = _materia.id;
  END LOOP;

  RETURN _nova_id;
END;
$$;

-- 3a. Trigger em cronograma_compras
CREATE OR REPLACE FUNCTION public.tg_clonar_on_compra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ativo' AND NEW.cronograma_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    PERFORM public.clonar_cronograma_para_usuario(NEW.cronograma_id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clonar_on_compra ON public.cronograma_compras;
CREATE TRIGGER trg_clonar_on_compra
AFTER INSERT OR UPDATE ON public.cronograma_compras
FOR EACH ROW EXECUTE FUNCTION public.tg_clonar_on_compra();

-- 3b. Trigger em assinaturas (Diamante => clona todos premium)
CREATE OR REPLACE FUNCTION public.tg_clonar_on_assinatura_diamante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tipo text;
  _c RECORD;
BEGIN
  IF NEW.status NOT IN ('ativa','cortesia','teste') THEN RETURN NEW; END IF;
  IF NEW.fim IS NOT NULL AND NEW.fim <= now() THEN RETURN NEW; END IF;

  SELECT tipo INTO _tipo FROM public.planos WHERE id = NEW.plano_id;
  IF _tipo IS DISTINCT FROM 'diamante' THEN RETURN NEW; END IF;

  FOR _c IN SELECT id FROM public.cronogramas WHERE is_proprio = false AND premium = true LOOP
    PERFORM public.clonar_cronograma_para_usuario(_c.id, NEW.user_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clonar_on_assinatura ON public.assinaturas;
CREATE TRIGGER trg_clonar_on_assinatura
AFTER INSERT OR UPDATE ON public.assinaturas
FOR EACH ROW EXECUTE FUNCTION public.tg_clonar_on_assinatura_diamante();

-- 4. Ajustar RLS de cronogramas: alunos comuns NÃO veem mais originais premium na listagem
DROP POLICY IF EXISTS "Cronogramas viewable by allowed users" ON public.cronogramas;
CREATE POLICY "Cronogramas viewable by allowed users"
ON public.cronogramas FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'moderador'::app_role)
  OR (is_proprio = true AND criado_por = auth.uid())
  OR (is_proprio = false AND premium = false)
);

-- 5. Restringir "Owner manage materias/topicos" — só vale para cronograma pessoal SEM origem (não-cópia)
DROP POLICY IF EXISTS "Owner manage materias of own cronograma (insert)" ON public.cronograma_materias;
DROP POLICY IF EXISTS "Owner manage materias of own cronograma (update)" ON public.cronograma_materias;
DROP POLICY IF EXISTS "Owner manage materias of own cronograma (delete)" ON public.cronograma_materias;

CREATE POLICY "Owner manage materias of own cronograma (insert)"
ON public.cronograma_materias FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.cronogramas c
  WHERE c.id = cronograma_materias.cronograma_id
    AND c.is_proprio = true AND c.criado_por = auth.uid() AND c.origem_id IS NULL
));
CREATE POLICY "Owner manage materias of own cronograma (update)"
ON public.cronograma_materias FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cronogramas c
  WHERE c.id = cronograma_materias.cronograma_id
    AND c.is_proprio = true AND c.criado_por = auth.uid() AND c.origem_id IS NULL
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.cronogramas c
  WHERE c.id = cronograma_materias.cronograma_id
    AND c.is_proprio = true AND c.criado_por = auth.uid() AND c.origem_id IS NULL
));
CREATE POLICY "Owner manage materias of own cronograma (delete)"
ON public.cronograma_materias FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cronogramas c
  WHERE c.id = cronograma_materias.cronograma_id
    AND c.is_proprio = true AND c.criado_por = auth.uid() AND c.origem_id IS NULL
));

DROP POLICY IF EXISTS "Owner manage topicos of own cronograma (insert)" ON public.cronograma_topicos;
DROP POLICY IF EXISTS "Owner manage topicos of own cronograma (update)" ON public.cronograma_topicos;
DROP POLICY IF EXISTS "Owner manage topicos of own cronograma (delete)" ON public.cronograma_topicos;

CREATE POLICY "Owner manage topicos of own cronograma (insert)"
ON public.cronograma_topicos FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.cronograma_materias m
  JOIN public.cronogramas c ON c.id = m.cronograma_id
  WHERE m.id = cronograma_topicos.materia_id
    AND c.is_proprio = true AND c.criado_por = auth.uid() AND c.origem_id IS NULL
));
CREATE POLICY "Owner manage topicos of own cronograma (update)"
ON public.cronograma_topicos FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cronograma_materias m
  JOIN public.cronogramas c ON c.id = m.cronograma_id
  WHERE m.id = cronograma_topicos.materia_id
    AND c.is_proprio = true AND c.criado_por = auth.uid() AND c.origem_id IS NULL
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.cronograma_materias m
  JOIN public.cronogramas c ON c.id = m.cronograma_id
  WHERE m.id = cronograma_topicos.materia_id
    AND c.is_proprio = true AND c.criado_por = auth.uid() AND c.origem_id IS NULL
));
CREATE POLICY "Owner manage topicos of own cronograma (delete)"
ON public.cronograma_topicos FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cronograma_materias m
  JOIN public.cronogramas c ON c.id = m.cronograma_id
  WHERE m.id = cronograma_topicos.materia_id
    AND c.is_proprio = true AND c.criado_por = auth.uid() AND c.origem_id IS NULL
));

-- 6. Backfill
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT cronograma_id, user_id FROM public.cronograma_compras WHERE status = 'ativo' AND cronograma_id IS NOT NULL LOOP
    PERFORM public.clonar_cronograma_para_usuario(r.cronograma_id, r.user_id);
  END LOOP;

  FOR r IN
    SELECT DISTINCT a.user_id, c.id AS cid
    FROM public.assinaturas a
    JOIN public.planos p ON p.id = a.plano_id
    CROSS JOIN public.cronogramas c
    WHERE a.status IN ('ativa','cortesia','teste')
      AND (a.fim IS NULL OR a.fim > now())
      AND p.tipo = 'diamante'
      AND c.is_proprio = false AND c.premium = true
  LOOP
    PERFORM public.clonar_cronograma_para_usuario(r.cid, r.user_id);
  END LOOP;
END$$;
