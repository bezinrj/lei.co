CREATE TABLE public.loja_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria text CHECK (categoria IN ('cronograma','ebook','material','mentoria','outro')),
  preco_centavos int,
  preco_original_centavos int,
  link_externo text NOT NULL,
  imagem_url text,
  badges text[] NOT NULL DEFAULT '{}',
  desconto_pct int,
  destaque boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_produtos ENABLE ROW LEVEL SECURITY;

-- Autenticados leem produtos ativos
CREATE POLICY "loja_select_ativos"
ON public.loja_produtos
FOR SELECT
TO authenticated
USING (ativo = true);

-- Admins veem todos (inclusive inativos)
CREATE POLICY "loja_admin_select_all"
ON public.loja_produtos
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins gerenciam tudo
CREATE POLICY "loja_admin_modify"
ON public.loja_produtos
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_loja_produtos_ativo_ordem ON public.loja_produtos (ativo, ordem);