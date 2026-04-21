ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_bloqueado ON public.profiles(bloqueado) WHERE bloqueado = true;