-- 1) Campo assunto opcional em cronograma_topicos
ALTER TABLE public.cronograma_topicos
  ADD COLUMN IF NOT EXISTS assunto text;

-- 2) Tabela de notas pessoais por tópico
CREATE TABLE IF NOT EXISTS public.user_notas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  topico_id uuid NOT NULL REFERENCES public.cronograma_topicos(id) ON DELETE CASCADE,
  nota text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topico_id)
);

ALTER TABLE public.user_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own notas"
  ON public.user_notas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "User inserts own notas"
  ON public.user_notas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User updates own notas"
  ON public.user_notas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "User deletes own notas"
  ON public.user_notas FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_notas_updated_at
  BEFORE UPDATE ON public.user_notas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_notas_user_topico
  ON public.user_notas (user_id, topico_id);