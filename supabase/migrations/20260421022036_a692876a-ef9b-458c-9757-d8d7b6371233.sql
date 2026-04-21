ALTER TABLE public.cronogramas ADD COLUMN IF NOT EXISTS preco_centavos int;
ALTER TABLE public.cronogramas ADD COLUMN IF NOT EXISTS stripe_price_id text;