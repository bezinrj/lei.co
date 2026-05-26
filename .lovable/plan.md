
## Objetivo

Garantir 3 regras claras na biblioteca de cronogramas:

1. **Cronograma Pessoal** (criado pelo aluno) é privado, único por aluno, e o aluno é dono total (editar/excluir).
2. **Cronograma Premium** (criado pela equipe) nunca pode ter sua matriz alterada por alunos.
3. Quando um aluno **ganha acesso** a um premium (compra individual OU plano Diamante), o sistema cria **automaticamente uma cópia individual** desse cronograma para ele. Cada aluno usa sua própria cópia — não há uso compartilhado.

A cópia é congelada: se o admin alterar o original depois, as cópias existentes permanecem como estão.

---

## Mudanças no banco

### 1. Coluna `origem_id` em `cronogramas`
- `origem_id uuid null` — referencia o cronograma premium original (apenas para cópias).
- Cópias premium do aluno são marcadas como: `is_proprio = true`, `criado_por = user_id`, `premium = false`, `origem_id = <id do original>`, `categoria = 'Premium (Minha cópia)'`.

### 2. Função `public.clonar_cronograma_para_usuario(_cronograma_id uuid, _user_id uuid)`
SECURITY DEFINER. Idempotente: se já existir cópia (`origem_id = _cronograma_id AND criado_por = _user_id`), retorna o id existente sem duplicar. Caso contrário, copia o cronograma + todas `cronograma_materias` + todos `cronograma_topicos` preservando ordem, cor, fontes, duração etc.

### 3. Triggers de clonagem automática
- **Em `cronograma_compras`** (AFTER INSERT/UPDATE): quando `status = 'ativo'`, chama `clonar_cronograma_para_usuario(cronograma_id, user_id)`.
- **Em `assinaturas`** (AFTER INSERT/UPDATE): quando assinatura entra em status ativo de plano **Diamante**, itera por todos `cronogramas` premium (`is_proprio = false AND premium = true`) e clona cada um para o usuário.

### 4. Ajustes de RLS
- **`cronogramas` SELECT premium originais**: alunos comuns NÃO veem mais os cronogramas premium "originais" na listagem (só veem suas cópias). Admin/mod continuam vendo originais. Free não premium continuam visíveis a todos.
- **`cronograma_materias` / `cronograma_topicos` UPDATE/INSERT/DELETE pelo dono pessoal**: restringir o "Owner manage…" para `c.is_proprio = true AND c.origem_id IS NULL` — assim a cópia premium fica com matriz 100% bloqueada para o aluno (só admin/mod podem editar, e na prática não vão editar cópias individuais).

### 5. Backfill
Para cada compra ativa existente e cada assinatura Diamante ativa, executar o clone uma vez (idempotente) para popular as cópias já devidas.

---

## Mudanças no frontend

### `src/routes/cronogramas.tsx`
- Agrupar cópias premium do aluno em uma seção própria: **"Meus Cronogramas Premium"** (separada de "Meu Cronograma" pessoal e das categorias institucionais).
- Critério: `is_proprio = true AND origem_id IS NOT NULL AND criado_por = user.id`.
- "Meu Cronograma" pessoal continua a seção só para `origem_id IS NULL`.
- Alunos comuns deixam de ver os cards premium "originais" (a query do RLS já filtra).

### `src/components/cronogramas/CategoryRow.tsx` / `CronogramaCard.tsx`
- Para cópias premium: ocultar ações de editar capa/nome/excluir (ícone de menu desabilitado). Mesma regra do "só estudar".

### `src/routes/cronograma.$id.tsx`
- Bloquear botões de editar matriz (adicionar matéria, adicionar tópico, editar capa) quando `cronograma.origem_id IS NOT NULL` e usuário não é admin/mod. A RLS já reforça no backend.

### Sem mudanças em compra/checkout
A clonagem é acionada pelos triggers no banco assim que a `cronograma_compras` vira `ativo` (já feito pelo webhook do Stripe) ou a `assinatura` Diamante fica ativa. Nenhuma alteração necessária no fluxo de pagamento.

---

## Detalhes técnicos

- A clonagem copia apenas estrutura (matérias + tópicos). **Não** copia progresso, sessões, eventos de calendário, notas — esses já são por usuário em tabelas `user_*` apontando para o `topico_id` da cópia (cada cópia tem seus próprios `topico_id` novos).
- Cópia é **congelada**: nenhum mecanismo de sincronização com o original. Decisão registrada acima.
- O limite de "1 cronograma pessoal por aluno" continua valendo só para o pessoal "verdadeiro" (`origem_id IS NULL AND is_proprio = true`). O `NovoCronogramaDialog` já faz essa checagem — ajustar para considerar `origem_id IS NULL`.
- Idempotência da clonagem evita duplicatas em re-execução de trigger ou backfill.

---

## Ordem de execução

1. Migração: coluna `origem_id`, função `clonar_cronograma_para_usuario`, triggers nas duas tabelas, ajuste das RLS de `cronogramas`/`materias`/`topicos`, backfill.
2. Frontend: separar seção "Meus Cronogramas Premium", bloquear ações nas cópias, ajustar checagem do dialog de novo cronograma.
3. Smoke test: simular `INSERT` em `cronograma_compras` com `status='ativo'` e verificar criação da cópia + tópicos.
