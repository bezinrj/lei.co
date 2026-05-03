ALTER TABLE public.cronograma_topicos
  ADD COLUMN IF NOT EXISTS doutrina text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS atencao text;