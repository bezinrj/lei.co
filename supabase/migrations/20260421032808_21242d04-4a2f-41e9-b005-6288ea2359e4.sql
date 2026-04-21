-- Adicionar colunas para cronogramas próprios
ALTER TABLE public.cronogramas
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.cronogramas
  ADD COLUMN IF NOT EXISTS is_proprio boolean NOT NULL DEFAULT false;

-- Índice único parcial: 1 cronograma próprio por usuário
CREATE UNIQUE INDEX IF NOT EXISTS cronogramas_um_proprio_por_user
  ON public.cronogramas (criado_por)
  WHERE is_proprio = true;

-- Index auxiliar para lookup
CREATE INDEX IF NOT EXISTS cronogramas_criado_por_idx
  ON public.cronogramas (criado_por);