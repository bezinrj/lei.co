-- Add fonte_index column to track unique fonts by position (sigla can be duplicated)
ALTER TABLE public.user_fonte_progress
  ADD COLUMN IF NOT EXISTS fonte_index integer;

-- Drop old unique constraint based on sigla
ALTER TABLE public.user_fonte_progress
  DROP CONSTRAINT IF EXISTS user_fonte_progress_user_id_topico_id_sigla_key;

-- Drop possible alternative unique index on (user_id, topico_id, sigla)
DROP INDEX IF EXISTS public.user_fonte_progress_user_id_topico_id_sigla_key;

-- New unique constraint based on index
ALTER TABLE public.user_fonte_progress
  DROP CONSTRAINT IF EXISTS user_fonte_progress_user_topico_index_key;

ALTER TABLE public.user_fonte_progress
  ADD CONSTRAINT user_fonte_progress_user_topico_index_key
  UNIQUE (user_id, topico_id, fonte_index);