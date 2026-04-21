-- Tabela de planos
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('mensal','trimestral','anual','diamante','cortesia')),
  preco_centavos int,
  stripe_price_id text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de assinaturas
CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plano_id uuid REFERENCES public.planos(id),
  stripe_subscription_id text,
  stripe_customer_id text,
  status text NOT NULL CHECK (status IN ('ativa','cancelada','expirada','cortesia','teste')),
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assinaturas_user ON public.assinaturas(user_id);
CREATE INDEX idx_assinaturas_status ON public.assinaturas(status);

-- Tabela de compras avulsas
CREATE TABLE public.cronograma_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cronograma_id uuid REFERENCES public.cronogramas(id),
  stripe_payment_intent_id text,
  status text NOT NULL CHECK (status IN ('ativo','reembolsado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cronograma_id)
);

CREATE INDEX idx_compras_user ON public.cronograma_compras(user_id);

-- Inserir planos base
INSERT INTO public.planos (nome, tipo, preco_centavos) VALUES
  ('Plano Mensal', 'mensal', 2990),
  ('Plano Trimestral', 'trimestral', 7990),
  ('Plano Anual', 'anual', 24990),
  ('Plano Diamante', 'diamante', 49900),
  ('Cortesia', 'cortesia', 0);

-- Habilitar RLS
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_compras ENABLE ROW LEVEL SECURITY;

-- Policies: planos
CREATE POLICY "planos_select_authenticated" ON public.planos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "planos_admin_all" ON public.planos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies: assinaturas
CREATE POLICY "assinaturas_select_own_or_staff" ON public.assinaturas
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderador')
  );

CREATE POLICY "assinaturas_admin_modify" ON public.assinaturas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies: compras
CREATE POLICY "compras_select_own_or_staff" ON public.cronograma_compras
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderador')
  );

CREATE POLICY "compras_admin_modify" ON public.cronograma_compras
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Função: tem assinatura ativa
CREATE OR REPLACE FUNCTION public.tem_assinatura_ativa(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assinaturas
    WHERE user_id = uid
      AND status IN ('ativa','cortesia','teste')
      AND (fim IS NULL OR fim > now())
  );
$$;

-- Função: tem acesso ao cronograma
CREATE OR REPLACE FUNCTION public.tem_acesso_cronograma(uid uuid, cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cronograma_compras
    WHERE user_id = uid AND cronograma_id = cid AND status = 'ativo'
  ) OR EXISTS (
    SELECT 1 FROM public.assinaturas a
    JOIN public.planos p ON a.plano_id = p.id
    WHERE a.user_id = uid
      AND p.tipo = 'diamante'
      AND a.status IN ('ativa','cortesia','teste')
      AND (a.fim IS NULL OR a.fim > now())
  );
$$;

-- Coluna plano_atual em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plano_atual text NOT NULL DEFAULT 'gratuito';

-- Função para sincronizar plano_atual em profiles
CREATE OR REPLACE FUNCTION public.sync_profile_plano_atual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alvo_user uuid;
  novo_plano text;
BEGIN
  alvo_user := COALESCE(NEW.user_id, OLD.user_id);

  SELECT p.tipo INTO novo_plano
  FROM public.assinaturas a
  JOIN public.planos p ON a.plano_id = p.id
  WHERE a.user_id = alvo_user
    AND a.status IN ('ativa','cortesia','teste')
    AND (a.fim IS NULL OR a.fim > now())
  ORDER BY a.inicio DESC
  LIMIT 1;

  UPDATE public.profiles
    SET plano_atual = COALESCE(novo_plano, 'gratuito')
    WHERE id = alvo_user;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_assinaturas_sync_plano
AFTER INSERT OR UPDATE OR DELETE ON public.assinaturas
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_plano_atual();