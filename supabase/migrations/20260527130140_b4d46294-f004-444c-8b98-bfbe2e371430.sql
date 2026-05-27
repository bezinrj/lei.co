
-- 1) Adicionar coluna 'origem' em cronograma_compras
ALTER TABLE public.cronograma_compras
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'compra';

ALTER TABLE public.cronograma_compras
  DROP CONSTRAINT IF EXISTS cronograma_compras_origem_check;

ALTER TABLE public.cronograma_compras
  ADD CONSTRAINT cronograma_compras_origem_check
  CHECK (origem IN ('compra', 'cortesia'));

-- 2) Remover trigger de clonagem para Diamante (Diamante usa originais)
DROP TRIGGER IF EXISTS trg_clonar_on_assinatura_diamante ON public.assinaturas;
DROP TRIGGER IF EXISTS tg_clonar_on_assinatura_diamante ON public.assinaturas;
DROP FUNCTION IF EXISTS public.tg_clonar_on_assinatura_diamante() CASCADE;

-- 3) Limpeza única: deletar cópias premium criadas pelo trigger Diamante para usuários
-- que NÃO possuem compra individual ativa (origem='compra') para aquele original.
-- Mantém cópias vindas de cortesia/compra (registradas em cronograma_compras).
DELETE FROM public.cronogramas c
WHERE c.origem_id IS NOT NULL
  AND c.is_proprio = true
  AND NOT EXISTS (
    SELECT 1 FROM public.cronograma_compras cc
    WHERE cc.user_id = c.criado_por
      AND cc.cronograma_id = c.origem_id
      AND cc.status = 'ativo'
  );
