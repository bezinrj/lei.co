ALTER TABLE public.cronograma_compras DROP CONSTRAINT cronograma_compras_status_check;
ALTER TABLE public.cronograma_compras
  ADD CONSTRAINT cronograma_compras_status_check
  CHECK (status = ANY (ARRAY['ativo'::text, 'cancelado'::text, 'reembolsado'::text]));