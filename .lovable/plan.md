## Objetivo

Permitir que Admin/Moderador acessem uma página dedicada por aluno, com Dashboard, área de Cronogramas e Desempenho do aluno selecionado, podendo navegar e analisar seus dados (com possibilidade de edição usando os mesmos componentes já existentes).

## Fluxo

1. No Painel Admin, ao clicar em **"Ver perfil"** no card do aluno, navega para `/admin/aluno/$id` (em vez de abrir apenas o Sheet lateral).
   - O Sheet de ações (bloquear, cortesia, role, etc.) fica acessível por um botão **"Ações & Plano"** dentro da nova página, mantendo todas as funcionalidades atuais.

2. A nova rota `/admin/aluno/$id` exibe, para o aluno selecionado:
   - **Cabeçalho**: avatar, nome, friend_id, plano, status online, botões "Voltar" e "Ações & Plano".
   - **Aba "Dashboard"**: métricas (horas, questões, sequência, badges) + Desempenho semanal + Hoje no cronograma + Desempenho por disciplinas/assuntos — reutilizando os componentes do dashboard atuais.
   - **Aba "Cronogramas"**: lista de cronogramas em que o aluno tem ativação/acesso. Ao selecionar um, mostra abas **Matriz / Calendário / Desempenho** daquele aluno naquele cronograma — reutilizando `MatrizTab`, `CalendarioTab`, `DesempenhoTab` que já aceitam `userId` como prop.

3. Admin/Moderador veem os dados como se fossem o próprio aluno e podem editar o que esses componentes já permitem editar (matriz, eventos do calendário, registros de sessão, ativação, etc.).

## Permissões

- A rota só pode ser acessada por usuários com role `admin` ou `moderador` (gate em `beforeLoad`; redireciona para `/perfil` caso contrário).
- Algumas tabelas (`user_calendar_events`, `user_topico_progresso`, `user_cronograma_ativacao`) hoje têm policies de SELECT só para `admin`. Para que **moderador** também consiga ler/editar os dados do aluno, criar policies espelho para moderador (SELECT/UPDATE/INSERT/DELETE) — escopo somente leitura de outros usuários + edição como suporte.

## Mudanças técnicas

### Componentes a tornar parametrizáveis por `userId`
Adicionar prop opcional `userId?: string` (quando ausente, mantém comportamento atual usando `useAuth`):
- `src/components/dashboard/WeeklyPerformance.tsx`
- `src/components/dashboard/TodaySchedule.tsx`
- `src/components/dashboard/SubjectPerformance.tsx`
- (`MatrizTab`, `CalendarioTab`, `DesempenhoTab` já aceitam `userId`.)

`GroupRanking` permanece sem alteração (não faz sentido como "ranking do aluno X").

### Nova rota
- `src/routes/admin.aluno.$id.tsx` — página com tabs Dashboard / Cronogramas.
  - Carrega `profiles` + `user_cronograma_ativacao` do aluno.
  - Lista cronogramas ativados; ao selecionar um, carrega matérias/tópicos/eventos/progresso do aluno alvo e renderiza `MatrizTab/CalendarioTab/DesempenhoTab` com `userId` do aluno.
  - Botão "Ações & Plano" reabre o `UserProfileSheet` existente (sem duplicar lógica de bloqueio/cortesia/role/reset/relatório).

### Painel Admin
- `src/routes/admin.tsx` (em `UserRow.onView`): trocar abertura do Sheet por `navigate({ to: '/admin/aluno/$id', params: { id: user.id } })`.

### Migração RLS (para moderador)
Adicionar policies para `moderador` em:
- `user_calendar_events` (SELECT/INSERT/UPDATE/DELETE de qualquer aluno)
- `user_topico_progresso` (idem)
- `user_cronograma_ativacao` (idem)
- `user_fonte_progress` já tem SELECT para mod; adicionar INSERT/UPDATE/DELETE.

Mantém-se as policies existentes do usuário sobre seus próprios dados.

## Fora do escopo

- Não cria modo "impersonar" global no header/sidebar — o uso é via /admin/aluno/$id.
- Não altera comportamento do `/dashboard` do próprio usuário.
- Não cria UI nova de edição além do que os componentes já oferecem.
