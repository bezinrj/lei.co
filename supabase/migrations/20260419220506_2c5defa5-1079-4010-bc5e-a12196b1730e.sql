-- 1. Add columns to cronograma_topicos
ALTER TABLE public.cronograma_topicos
  ADD COLUMN IF NOT EXISTS fontes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS horas_estimadas integer NOT NULL DEFAULT 3;

-- 2. Add cor column to cronograma_materias is already there; ensure it stores hex
-- (kept as-is, code will write hex strings)

-- 3. user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topico_id uuid NOT NULL REFERENCES public.cronograma_topicos(id) ON DELETE CASCADE,
  tempo_estudado text,
  questoes integer NOT NULL DEFAULT 0,
  acertos integer NOT NULL DEFAULT 0,
  percentual_acerto integer NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own sessions" ON public.user_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));

CREATE POLICY "User inserts own sessions" ON public.user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User updates own sessions" ON public.user_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "User deletes own sessions" ON public.user_sessions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_topico ON public.user_sessions(user_id, topico_id);

-- 4. user_fonte_progress table
CREATE TABLE IF NOT EXISTS public.user_fonte_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topico_id uuid NOT NULL REFERENCES public.cronograma_topicos(id) ON DELETE CASCADE,
  sigla text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topico_id, sigla)
);

ALTER TABLE public.user_fonte_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own fonte progress" ON public.user_fonte_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));

CREATE POLICY "User inserts own fonte progress" ON public.user_fonte_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User updates own fonte progress" ON public.user_fonte_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "User deletes own fonte progress" ON public.user_fonte_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_fonte_progress_updated
  BEFORE UPDATE ON public.user_fonte_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_fonte_progress_user_topico ON public.user_fonte_progress(user_id, topico_id);
