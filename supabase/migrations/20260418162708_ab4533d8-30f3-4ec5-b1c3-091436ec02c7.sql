-- =========================
-- MATÉRIAS DO CRONOGRAMA
-- =========================
CREATE TABLE public.cronograma_materias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cronograma_id UUID NOT NULL REFERENCES public.cronogramas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT 'sage', -- sage | blush | lilac | sky | cream | sage-dark
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_materias_cronograma ON public.cronograma_materias(cronograma_id);
ALTER TABLE public.cronograma_materias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Materias viewable by authenticated"
  ON public.cronograma_materias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/mods insert materias"
  ON public.cronograma_materias FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderador'));
CREATE POLICY "Admins/mods update materias"
  ON public.cronograma_materias FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderador'));
CREATE POLICY "Admins/mods delete materias"
  ON public.cronograma_materias FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderador'));

CREATE TRIGGER trg_materias_updated
  BEFORE UPDATE ON public.cronograma_materias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TÓPICOS
-- =========================
CREATE TABLE public.cronograma_topicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  materia_id UUID NOT NULL REFERENCES public.cronograma_materias(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_topicos_materia ON public.cronograma_topicos(materia_id);
ALTER TABLE public.cronograma_topicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Topicos viewable by authenticated"
  ON public.cronograma_topicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/mods insert topicos"
  ON public.cronograma_topicos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderador'));
CREATE POLICY "Admins/mods update topicos"
  ON public.cronograma_topicos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderador'));
CREATE POLICY "Admins/mods delete topicos"
  ON public.cronograma_topicos FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderador'));

CREATE TRIGGER trg_topicos_updated
  BEFORE UPDATE ON public.cronograma_topicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- ATIVAÇÃO DO CRONOGRAMA POR USUÁRIO
-- =========================
CREATE TABLE public.user_cronograma_ativacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cronograma_id UUID NOT NULL REFERENCES public.cronogramas(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prova DATE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cronograma_id)
);
ALTER TABLE public.user_cronograma_ativacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own ativacao"
  ON public.user_cronograma_ativacao FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "User inserts own ativacao"
  ON public.user_cronograma_ativacao FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own ativacao"
  ON public.user_cronograma_ativacao FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "User deletes own ativacao"
  ON public.user_cronograma_ativacao FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_ativacao_updated
  BEFORE UPDATE ON public.user_cronograma_ativacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- PROGRESSO POR TÓPICO
-- =========================
CREATE TABLE public.user_topico_progresso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topico_id UUID NOT NULL REFERENCES public.cronograma_topicos(id) ON DELETE CASCADE,
  concluido BOOLEAN NOT NULL DEFAULT false,
  minutos_estudados INTEGER NOT NULL DEFAULT 0,
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, topico_id)
);
CREATE INDEX idx_progresso_user ON public.user_topico_progresso(user_id);
ALTER TABLE public.user_topico_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own progresso"
  ON public.user_topico_progresso FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "User inserts own progresso"
  ON public.user_topico_progresso FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own progresso"
  ON public.user_topico_progresso FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "User deletes own progresso"
  ON public.user_topico_progresso FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_progresso_updated
  BEFORE UPDATE ON public.user_topico_progresso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- EVENTOS DE CALENDÁRIO
-- =========================
CREATE TABLE public.user_calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cronograma_id UUID REFERENCES public.cronogramas(id) ON DELETE CASCADE,
  materia_id UUID REFERENCES public.cronograma_materias(id) ON DELETE SET NULL,
  topico_id UUID REFERENCES public.cronograma_topicos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  data DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  cor TEXT,
  concluido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_user_data ON public.user_calendar_events(user_id, data);
ALTER TABLE public.user_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own events"
  ON public.user_calendar_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "User inserts own events"
  ON public.user_calendar_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own events"
  ON public.user_calendar_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "User deletes own events"
  ON public.user_calendar_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_events_updated
  BEFORE UPDATE ON public.user_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- PLANO DO USUÁRIO (free / premium)
-- =========================
CREATE TYPE public.plan_type AS ENUM ('free','premium');

CREATE TABLE public.user_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tipo public.plan_type NOT NULL DEFAULT 'free',
  inicio_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own plan"
  ON public.user_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "User inserts own plan"
  ON public.user_plans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own plan"
  ON public.user_plans FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all plans"
  ON public.user_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_plans_updated
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();