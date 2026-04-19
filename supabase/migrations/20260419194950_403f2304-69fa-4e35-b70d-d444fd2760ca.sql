-- 1) Adicionar campos de perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS concurso_alvo TEXT,
  ADD COLUMN IF NOT EXISTS data_prova DATE;

-- 2) Catálogo de badges
CREATE TABLE IF NOT EXISTS public.badges (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  icone TEXT NOT NULL,
  cor TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges viewable by authenticated"
  ON public.badges FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage badges"
  ON public.badges FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) Badges desbloqueadas pelo usuário
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_id TEXT NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  publica BOOLEAN NOT NULL DEFAULT true,
  destaque BOOLEAN NOT NULL DEFAULT false,
  desbloqueada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Apenas as badges públicas dos outros são visíveis; o próprio usuário vê todas as suas
CREATE POLICY "User views own badges, others see public"
  ON public.user_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR publica = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "User inserts own badges"
  ON public.user_badges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User updates own badges"
  ON public.user_badges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "User deletes own badges"
  ON public.user_badges FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_badges_updated_at
  BEFORE UPDATE ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Garantir somente uma badge em destaque por usuário
CREATE OR REPLACE FUNCTION public.enforce_single_destaque_badge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.destaque = true THEN
    UPDATE public.user_badges
      SET destaque = false
      WHERE user_id = NEW.user_id
        AND id <> NEW.id
        AND destaque = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_destaque_badge
  AFTER INSERT OR UPDATE OF destaque ON public.user_badges
  FOR EACH ROW
  WHEN (NEW.destaque = true)
  EXECUTE FUNCTION public.enforce_single_destaque_badge();

-- 5) Popular catálogo de badges
INSERT INTO public.badges (id, nome, descricao, icone, cor, ordem) VALUES
  ('largada',         'Largada',          'Completou o primeiro dia de estudos',                  '🏃', 'blush', 1),
  ('chama_viva',      'Chama Viva',       'Mantém uma sequência ativa de estudos',                '🔥', 'blush', 2),
  ('semana_perfeita', 'Semana Perfeita',  'Estudou 7 dias seguidos',                              '📅', 'sage',  3),
  ('mes_completo',    'Mês Completo',     'Estudou 30 dias seguidos',                             '🗓️', 'sage',  4),
  ('coruja',          'Coruja',           'Registrou estudo após as 22h',                         '🌙', 'lilac', 5),
  ('madrugador',      'Madrugador',       'Registrou estudo antes das 7h',                        '☀️', 'sky',   6),
  ('primeiras_100',   'Primeiras 100',    'Respondeu 100 questões',                               '📚', 'blush', 7),
  ('mil_questoes',    'Mil Questões',     'Respondeu 1000 questões',                              '📖', 'lilac', 8),
  ('mira_certeira',   'Mira Certeira',    'Atingiu 90% de acerto em uma sessão',                  '🎯', 'sage',  9),
  ('maratonista',     'Maratonista',      'Estudou mais de 8 horas em um único dia',              '⏱️', 'sky',  10),
  ('cem_horas',       'Cem Horas',        'Acumulou 100 horas de estudo',                         '📖', 'lilac',11),
  ('quinhentas_horas','Quinhentas Horas', 'Acumulou 500 horas de estudo',                         '⚡', 'sage', 12),
  ('primeiro_grupo',  'Primeiro Grupo',   'Entrou ou criou seu primeiro grupo',                   '🤝', 'sage', 13),
  ('top_3',           'Top 3',            'Ficou entre os 3 primeiros no ranking de um grupo',    '🏆', 'blush',14),
  ('lider',           'Líder',            'Ficou em 1º lugar no ranking de um grupo',             '👑', 'sky',  15),
  ('decolagem',       'Decolagem',        'Completou o primeiro cronograma',                      '🚀', 'lilac',16),
  ('veterano',        'Veterano',         'Completou 3 cronogramas diferentes',                   '🎓', 'sage', 17),
  ('lenda',           'Lenda',            'Desbloqueou todas as outras badges',                   '🌟', 'sky',  18)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  cor = EXCLUDED.cor,
  ordem = EXCLUDED.ordem;

-- 6) Bucket para avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
