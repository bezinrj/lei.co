ALTER TABLE public.user_sessions ALTER COLUMN questoes DROP NOT NULL;
ALTER TABLE public.user_sessions ALTER COLUMN questoes DROP DEFAULT;
ALTER TABLE public.user_sessions ALTER COLUMN acertos DROP NOT NULL;
ALTER TABLE public.user_sessions ALTER COLUMN acertos DROP DEFAULT;
ALTER TABLE public.user_sessions ALTER COLUMN percentual_acerto DROP NOT NULL;
ALTER TABLE public.user_sessions ALTER COLUMN percentual_acerto DROP DEFAULT;