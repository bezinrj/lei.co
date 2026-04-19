ALTER TABLE public.user_calendar_events ADD COLUMN IF NOT EXISTS is_revisao boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_uce_user_data ON public.user_calendar_events(user_id, data);