
-- =====================================================
-- 1) PROFILES: restringir tabela base + view pública
-- =====================================================
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Profiles selectable by self or staff"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderador'::app_role)
  );

CREATE OR REPLACE VIEW public.profiles_public
  WITH (security_invoker = on) AS
  SELECT id, display_name, avatar_url, friend_id, bio, plano_atual, last_seen, created_at
  FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- Política espelho na view para permitir leitura pública dos campos seguros
-- (security_invoker delega para policies do owner do statement; vamos abrir a base
-- só para os campos da view via policy adicional)
CREATE POLICY "Profiles public fields readable"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);
-- ^ Esta policy mantém o SELECT "true" mas como tabela base ainda expõe colunas
-- sensíveis, vamos REMOVÊ-LA e usar APENAS a view. A leitura direta de profiles
-- por terceiros some.
DROP POLICY "Profiles public fields readable" ON public.profiles;

-- =====================================================
-- 2) GRUPOS: restringir base + view sem código + RPC entrar por código
-- =====================================================
DROP POLICY IF EXISTS "grupos_select_all" ON public.grupos;

CREATE POLICY "grupos_select_members_or_staff"
  ON public.grupos FOR SELECT TO authenticated
  USING (
    is_grupo_membro(id, auth.uid())
    OR auth.uid() = criado_por
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderador'::app_role)
  );

CREATE OR REPLACE VIEW public.grupos_public
  WITH (security_invoker = on) AS
  SELECT id, nome, descricao, foto_url, max_membros, criado_por, created_at
  FROM public.grupos;

GRANT SELECT ON public.grupos_public TO authenticated;

-- RPC para entrar em grupo via código (sem expor codigo_convite)
CREATE OR REPLACE FUNCTION public.entrar_grupo_por_codigo(_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grupo_id uuid;
  _nome text;
  _max int;
  _atual int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, nome, max_membros INTO _grupo_id, _nome, _max
  FROM public.grupos WHERE codigo_convite = _codigo;

  IF _grupo_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.grupo_membros WHERE grupo_id = _grupo_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_member', 'grupo_id', _grupo_id, 'nome', _nome);
  END IF;

  SELECT COUNT(*) INTO _atual FROM public.grupo_membros WHERE grupo_id = _grupo_id;
  IF _atual >= _max THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;

  INSERT INTO public.grupo_membros (grupo_id, user_id, role)
  VALUES (_grupo_id, auth.uid(), 'membro');

  RETURN jsonb_build_object('ok', true, 'grupo_id', _grupo_id, 'nome', _nome);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.entrar_grupo_por_codigo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entrar_grupo_por_codigo(text) TO authenticated;

-- =====================================================
-- 3) Sub-tabelas de grupo: SELECT só para membros/staff
-- =====================================================
DROP POLICY IF EXISTS "membros_select_all" ON public.grupo_membros;
CREATE POLICY "membros_select_members_or_staff"
  ON public.grupo_membros FOR SELECT TO authenticated
  USING (
    is_grupo_membro(grupo_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderador'::app_role)
  );

DROP POLICY IF EXISTS "desafios_select_all" ON public.grupo_desafios;
CREATE POLICY "desafios_select_members"
  ON public.grupo_desafios FOR SELECT TO authenticated
  USING (
    is_grupo_membro(grupo_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderador'::app_role)
  );

DROP POLICY IF EXISTS "metas_select_all" ON public.grupo_metas;
CREATE POLICY "metas_select_members"
  ON public.grupo_metas FOR SELECT TO authenticated
  USING (
    is_grupo_membro(grupo_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderador'::app_role)
  );

DROP POLICY IF EXISTS "desafios_membros_select_all" ON public.grupo_desafios_membros;
CREATE POLICY "desafios_membros_select_members"
  ON public.grupo_desafios_membros FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.grupo_desafios d
      WHERE d.id = desafio_id AND is_grupo_membro(d.grupo_id, auth.uid())
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- =====================================================
-- 4) XP: SECURITY DEFINER RPC + remover writes diretos
-- =====================================================

-- Garantir UNIQUE necessários para upserts via RPC
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_xp_user_id_key'
  ) THEN
    ALTER TABLE public.user_xp ADD CONSTRAINT user_xp_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_xp_diario_user_data_key'
  ) THEN
    ALTER TABLE public.user_xp_diario ADD CONSTRAINT user_xp_diario_user_data_key UNIQUE (user_id, data);
  END IF;
END $$;

DROP POLICY IF EXISTS "xp_insert_self" ON public.user_xp;
DROP POLICY IF EXISTS "xp_update_self" ON public.user_xp;

DROP POLICY IF EXISTS "xp_diario_insert_self" ON public.user_xp_diario;
DROP POLICY IF EXISTS "xp_diario_update_self" ON public.user_xp_diario;

CREATE OR REPLACE FUNCTION public.award_xp(
  _xp_ganho int,
  _horas_add numeric DEFAULT 0,
  _questoes_add int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := CURRENT_DATE;
  _xp_total int;
  _nivel int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _xp_ganho IS NULL OR _xp_ganho < 0 OR _xp_ganho > 500 THEN
    RAISE EXCEPTION 'xp_ganho inválido';
  END IF;
  IF _horas_add IS NULL OR _horas_add < 0 OR _horas_add > 24 THEN
    RAISE EXCEPTION 'horas inválidas';
  END IF;
  IF _questoes_add IS NULL OR _questoes_add < 0 OR _questoes_add > 1000 THEN
    RAISE EXCEPTION 'questoes inválidas';
  END IF;

  INSERT INTO public.user_xp_diario (user_id, data, xp_ganho, horas_computadas, questoes_computadas)
  VALUES (_uid, _today, _xp_ganho, _horas_add, _questoes_add)
  ON CONFLICT (user_id, data) DO UPDATE
    SET xp_ganho = public.user_xp_diario.xp_ganho + EXCLUDED.xp_ganho,
        horas_computadas = public.user_xp_diario.horas_computadas + EXCLUDED.horas_computadas,
        questoes_computadas = public.user_xp_diario.questoes_computadas + EXCLUDED.questoes_computadas;

  INSERT INTO public.user_xp (user_id, xp_total, nivel)
  VALUES (_uid, _xp_ganho, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET xp_total = public.user_xp.xp_total + EXCLUDED.xp_total,
        updated_at = now()
  RETURNING xp_total, nivel INTO _xp_total, _nivel;

  RETURN jsonb_build_object('xp_total', _xp_total, 'nivel', _nivel);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(int, numeric, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(int, numeric, int) TO authenticated;

-- =====================================================
-- 5) Bucket grupos-fotos: restringir upload a membro/fundador
-- =====================================================
DROP POLICY IF EXISTS "Authenticated upload grupos fotos" ON storage.objects;

CREATE POLICY "Grupo member/founder uploads grupos-fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'grupos-fotos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.grupos g
      WHERE g.id::text = (storage.foldername(name))[1]
        AND (
          g.criado_por = auth.uid()
          OR public.is_grupo_membro(g.id, auth.uid())
        )
    )
  );

-- =====================================================
-- 6) search_path nas funções de e-mail
-- =====================================================
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
