-- =========================================
-- TABELAS
-- =========================================

CREATE TABLE public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  foto_url text,
  codigo_convite text UNIQUE NOT NULL,
  criado_por uuid NOT NULL,
  max_membros int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grupo_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'membro' CHECK (role IN ('fundador','membro')),
  privacidade_horas boolean NOT NULL DEFAULT true,
  privacidade_questoes boolean NOT NULL DEFAULT true,
  privacidade_acerto boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, user_id)
);

CREATE TABLE public.grupo_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('horas','questoes','streak','topicos')),
  valor_alvo int NOT NULL,
  valor_atual int NOT NULL DEFAULT 0,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz NOT NULL,
  concluida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grupo_desafios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  xp_recompensa int NOT NULL DEFAULT 10,
  prazo timestamptz NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grupo_desafios_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id uuid NOT NULL REFERENCES public.grupo_desafios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  concluido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (desafio_id, user_id)
);

CREATE TABLE public.grupo_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_xp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  xp_total int NOT NULL DEFAULT 0,
  nivel int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_xp_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horas_computadas numeric NOT NULL DEFAULT 0,
  questoes_computadas int NOT NULL DEFAULT 0,
  xp_ganho int NOT NULL DEFAULT 0,
  UNIQUE (user_id, data)
);

-- Índices úteis
CREATE INDEX idx_grupo_membros_user ON public.grupo_membros(user_id);
CREATE INDEX idx_grupo_membros_grupo ON public.grupo_membros(grupo_id);
CREATE INDEX idx_grupo_atividades_grupo ON public.grupo_atividades(grupo_id, created_at DESC);
CREATE INDEX idx_user_xp_total ON public.user_xp(xp_total DESC);

-- =========================================
-- FUNÇÃO HELPER (security definer evita recursão de RLS)
-- =========================================

CREATE OR REPLACE FUNCTION public.is_grupo_membro(_grupo_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.grupo_membros
    WHERE grupo_id = _grupo_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_grupo_fundador(_grupo_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.grupos
    WHERE id = _grupo_id AND criado_por = _user_id
  );
$$;

-- =========================================
-- TRIGGERS
-- =========================================

CREATE TRIGGER trg_grupos_updated_at
  BEFORE UPDATE ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_user_xp_updated_at
  BEFORE UPDATE ON public.user_xp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ao criar grupo, insere o criador como fundador automaticamente
CREATE OR REPLACE FUNCTION public.add_fundador_on_grupo_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.grupo_membros (grupo_id, user_id, role)
  VALUES (NEW.id, NEW.criado_por, 'fundador');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grupos_add_fundador
  AFTER INSERT ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.add_fundador_on_grupo_insert();

-- =========================================
-- RLS
-- =========================================

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_desafios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_desafios_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_xp_diario ENABLE ROW LEVEL SECURITY;

-- ===== grupos =====
CREATE POLICY "grupos_select_all" ON public.grupos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "grupos_insert_own" ON public.grupos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "grupos_update_fundador" ON public.grupos
  FOR UPDATE TO authenticated
  USING (auth.uid() = criado_por OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = criado_por OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "grupos_delete_fundador" ON public.grupos
  FOR DELETE TO authenticated
  USING (auth.uid() = criado_por OR has_role(auth.uid(), 'admin'::app_role));

-- ===== grupo_membros =====
CREATE POLICY "membros_select_all" ON public.grupo_membros
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "membros_insert_self" ON public.grupo_membros
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "membros_update_self" ON public.grupo_membros
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "membros_delete_self_or_fundador" ON public.grupo_membros
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_grupo_fundador(grupo_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ===== grupo_metas =====
CREATE POLICY "metas_select_all" ON public.grupo_metas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "metas_insert_fundador" ON public.grupo_metas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_grupo_fundador(grupo_id, auth.uid()));

CREATE POLICY "metas_update_fundador" ON public.grupo_metas
  FOR UPDATE TO authenticated
  USING (public.is_grupo_fundador(grupo_id, auth.uid()))
  WITH CHECK (public.is_grupo_fundador(grupo_id, auth.uid()));

CREATE POLICY "metas_delete_fundador" ON public.grupo_metas
  FOR DELETE TO authenticated
  USING (public.is_grupo_fundador(grupo_id, auth.uid()));

-- ===== grupo_desafios =====
CREATE POLICY "desafios_select_all" ON public.grupo_desafios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "desafios_insert_fundador" ON public.grupo_desafios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_grupo_fundador(grupo_id, auth.uid())
    AND auth.uid() = criado_por
  );

CREATE POLICY "desafios_update_fundador" ON public.grupo_desafios
  FOR UPDATE TO authenticated
  USING (public.is_grupo_fundador(grupo_id, auth.uid()))
  WITH CHECK (public.is_grupo_fundador(grupo_id, auth.uid()));

CREATE POLICY "desafios_delete_fundador" ON public.grupo_desafios
  FOR DELETE TO authenticated
  USING (public.is_grupo_fundador(grupo_id, auth.uid()));

-- ===== grupo_desafios_membros =====
CREATE POLICY "desafios_membros_select_all" ON public.grupo_desafios_membros
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "desafios_membros_insert_self" ON public.grupo_desafios_membros
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "desafios_membros_delete_self" ON public.grupo_desafios_membros
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ===== grupo_atividades =====
CREATE POLICY "atividades_select_membros" ON public.grupo_atividades
  FOR SELECT TO authenticated
  USING (public.is_grupo_membro(grupo_id, auth.uid()));

CREATE POLICY "atividades_insert_self_membro" ON public.grupo_atividades
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_grupo_membro(grupo_id, auth.uid())
  );

CREATE POLICY "atividades_delete_self_or_fundador" ON public.grupo_atividades
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_grupo_fundador(grupo_id, auth.uid())
  );

-- ===== user_xp =====
CREATE POLICY "xp_select_all" ON public.user_xp
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "xp_insert_self" ON public.user_xp
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "xp_update_self" ON public.user_xp
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===== user_xp_diario =====
CREATE POLICY "xp_diario_select_self" ON public.user_xp_diario
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "xp_diario_insert_self" ON public.user_xp_diario
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "xp_diario_update_self" ON public.user_xp_diario
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);