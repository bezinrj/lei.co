
## 1. Painel Admin — conceder cronogramas premium manualmente

Em `UserProfileSheet`, adicionar uma nova seção **"Cronogramas premium"** (após "Assinatura"):

- Lista todos os cronogramas premium (`is_proprio=false, premium=true, origem_id IS NULL`).
- Para cada um, mostra um chip de status do usuário:
  - **"Concedido (cortesia)"** — quando há `cronograma_compras` ativo com `origem='cortesia'` (novo valor).
  - **"Comprado"** — quando há `cronograma_compras` ativo com `origem='compra'`.
  - **"Sem acesso"** — caso contrário.
- Botões por cronograma:
  - **"Conceder"** (quando sem acesso) → cria `cronograma_compras (status='ativo', origem='cortesia')` e dispara o trigger existente que clona o cronograma para o aluno.
  - **"Revogar cortesia"** (quando origem='cortesia') → marca a compra como `cancelada` e remove a cópia clonada do aluno (`cronogramas` com `origem_id=esse_cron` e `criado_por=user`, junto com matérias/tópicos/eventos derivados).
  - **"Comprado"** fica readonly (vitalício, não é admin-revogável).

Novas serverFns em `src/server/admin-extra.functions.ts`:
- `listarAcessosPremium({ userId })` → retorna `[{ cronograma_id, nome, status, origem }]`.
- `concederCronogramaPremium({ userId, cronogramaId })`.
- `revogarCronogramaPremium({ userId, cronogramaId })`.

**Migration**:
- Adicionar coluna `origem text not null default 'compra'` em `cronograma_compras` com check (`'compra' | 'cortesia'`).
- Backfill existente como `'compra'`.

## 2. Diamante — acesso enquanto vigente (não vitalício)

Comportamento atual: trigger `tg_clonar_on_assinatura_diamante` clona TODOS os cronogramas premium para o usuário Diamante, e essas cópias ficam para sempre.

Novo comportamento:
- **Remover o trigger `tg_clonar_on_assinatura_diamante`** e revisar `clonar_cronograma_para_usuario` para que continue funcionando apenas via compra individual (cortesia/compra).
- Diamante passa a usar os **originais** diretamente: `tem_acesso_cronograma` já retorna `true` para Diamante ativo, então o estudo acontece nos `cronograma_id` originais. Progresso (`user_calendar_events`, `user_topico_progresso`, `user_sessions`) já é por `user_id`, então cada Diamante tem progresso isolado mesmo compartilhando o mesmo `cronograma_id` original.
- Estudante Diamante NÃO pode alterar a matriz (RLS de `cronograma_materias`/`cronograma_topicos` já bloqueia escrita em premium não-próprio).
- Quando Diamante expira (`assinaturas.fim <= now()` ou `status != ativa/cortesia/teste`), `tem_acesso_cronograma` automaticamente retorna `false` → o aluno perde acesso ao calendário/matriz dos cronogramas premium originais. Progresso fica preservado no banco mas inacessível pela UI até reativação.
- **Limpeza única**: migration que deleta as cópias já clonadas para usuários Diamante via trigger antigo (cópias onde o usuário é Diamante ativo E não existe `cronograma_compras` ativo para aquele `origem_id`). Isso evita o "frozen forever" residual.

Ajustes no frontend:
- `useAcesso.ts`: nenhuma mudança (já lê `compras` e `isDiamante` corretamente).
- `cronogramas.tsx`: o filtro `minhasCopiasPremium` continua mostrando as cópias de compra/cortesia; cronogramas premium originais passam a aparecer na seção "Cronogramas Premium" (vitrine) com cadeado quando sem acesso, ou clicáveis (acesso direto ao original) para Diamante. Atualizar `isLocked` para usar `acesso.temAcessoCronograma`.

## 3. Diamante — copy fix

Em `src/routes/meu-plano.tsx`, no array de benefícios do plano `diamante`, trocar:

```diff
- "Mentoria individual inclusa",
+ "30 dias de Mentoria individual",
```

## 4. Botão "Dashboard" do aluno — espelhar dashboard real

A rota `/admin/aluno/$id` já existe, mas o `DashboardDoAluno` lá tem código próprio que diverge do `/dashboard` real (faltam `GroupRanking` e o card "Desempenho").

- Refatorar `src/routes/dashboard.tsx` extraindo o corpo em um componente `<DashboardView userId={string} readonly?={boolean} />` em `src/components/dashboard/DashboardView.tsx`.
- `/dashboard` passa `userId={user.id}`.
- `/admin/aluno/$id` Dashboard tab passa `userId={studentId} readonly`. Substituir `DashboardDoAluno` por `<DashboardView userId={studentId} readonly />`.
- Garantir que todos os subcomponentes (`WeeklyPerformance`, `TodaySchedule`, `SubjectPerformance`, `GroupRanking`, `MetricCard`) já aceitam `userId` por prop (já aceitam).
- No header de `/admin/aluno/$id`, manter o badge "Visualizando como Administrador" para deixar claro que é a visão real do aluno.

## Resumo de arquivos

- **Migration**: coluna `origem` em `cronograma_compras` + drop do trigger Diamante + limpeza de cópias Diamante órfãs.
- **`src/server/admin-extra.functions.ts`**: 3 novas serverFns (listar/conceder/revogar premium).
- **`src/components/admin/UserProfileSheet.tsx`**: nova seção "Cronogramas premium".
- **`src/routes/meu-plano.tsx`**: copy do Diamante.
- **`src/components/dashboard/DashboardView.tsx`** (novo): conteúdo extraído do `/dashboard`.
- **`src/routes/dashboard.tsx`**: usa `DashboardView`.
- **`src/routes/admin.aluno.$id.tsx`**: troca `DashboardDoAluno` por `DashboardView` em modo readonly.
- **`src/routes/cronogramas.tsx`**: ajustar `isLocked` da vitrine premium para Diamante poder abrir o original.
