## Problemas

**1) Erro ao revogar cronograma premium**
A constraint `cronograma_compras_status_check` aceita apenas `'ativo'` e `'reembolsado'`. O código `revogarCronogramaPremium` em `admin-extra.functions.ts` faz `update({ status: "cancelado" })`, o que viola o check e dispara o erro do print.

**2) "Dashboard" do aluno redireciona para `/perfil`**
Em `useAuth.tsx`, `getSession()` carrega `roles` via `loadRoles`, mas `loadRoles` é guardada por `loadedRolesForUserId.current`. O listener `onAuthStateChange` dispara `INITIAL_SESSION` antes do `getSession().then(...)` resolver, marcando o ref. Quando `getSession` chama `loadRoles` em seguida, a função retorna imediatamente (ref bate) e `setLoading(false)` roda **antes do `setRoles`** terminar. Resultado: por 1 render, `authLoading=false` e `roles=[]`, então o gate em `admin.aluno.$id.tsx` (`if (!isStaff) navigate("/perfil")`) dispara, mesmo o usuário sendo admin. Recarregar a página faz o usuário cair em `/perfil`.

A página em si (`/admin/aluno/$id`) já tem aba Dashboard (com métricas, semana, hoje, desempenho por matéria) e aba Cronogramas (com Matriz, Calendário e Desempenho) do aluno. Depois de eliminar o redirect, o admin já consulta perfil, dashboard e cronograma atual de qualquer usuário.

## Mudanças

### a) Migration: ampliar `cronograma_compras_status_check`
```sql
ALTER TABLE public.cronograma_compras DROP CONSTRAINT cronograma_compras_status_check;
ALTER TABLE public.cronograma_compras
  ADD CONSTRAINT cronograma_compras_status_check
  CHECK (status = ANY (ARRAY['ativo','cancelado','reembolsado']));
```

### b) `src/hooks/useAuth.tsx` — corrigir race do gate
Tornar `loadRoles` retornar a Promise compartilhada quando já existe carregamento em andamento, e só liberar `setLoading(false)` em `getSession().then` depois que a Promise de `loadRoles` (mesmo a iniciada pelo listener) tiver resolvido. Padrão: trocar `loadedRolesForUserId.current` por um `rolesPromise.current` (`Map<userId, Promise<void>>`) e, no `getSession`, fazer `await rolesPromise.current.get(userId) ?? loadRoles(userId)` antes de `setLoading(false)`. Mantém comportamento atual de evitar refetch duplo.

### c) `src/routes/admin.aluno.$id.tsx` — gate seguro
Defesa adicional: só redirecionar para `/perfil` quando `!authLoading && user && roles.length > 0 && !isStaff`. Enquanto `roles` está vazio mantém o estado de "Carregando…". Isso evita qualquer regressão futura de race no provider.

### d) Confirmar acessos do admin
A página `/admin/aluno/$id` já lê `profiles`, `user_sessions`, `user_badges`, `user_calendar_events`, `cronograma_materias`, `cronograma_topicos` e `user_cronograma_ativacao` diretamente. Verificar que as policies dessas tabelas permitem `SELECT` para admin via `has_role(auth.uid(),'admin')` — se alguma estiver bloqueando, adicionar policy `"Admins podem ver tudo"` `FOR SELECT USING (has_role(auth.uid(),'admin'))`. (Verificarei no momento da implementação e incluirei na mesma migration se necessário.)

## Arquivos
- nova migration: ajuste do check e (se necessário) policies de admin
- `src/hooks/useAuth.tsx`
- `src/routes/admin.aluno.$id.tsx`

Sem mudanças em UI/visual — apenas correções de bug e permissão.