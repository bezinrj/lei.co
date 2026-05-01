-- Add columns to grupo_metas to support custom goals from founder
ALTER TABLE public.grupo_metas
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS xp_distribuido BOOLEAN NOT NULL DEFAULT false;