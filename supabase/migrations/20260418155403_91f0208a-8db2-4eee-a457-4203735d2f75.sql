CREATE TABLE public.presence (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own presence"
ON public.presence FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all presence"
ON public.presence FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can upsert own presence"
ON public.presence FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
ON public.presence FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_presence_last_seen ON public.presence (last_seen_at DESC);