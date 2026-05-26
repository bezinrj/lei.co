O problema é que o botão **“Ver perfil”** foi alterado para fazer uma navegação direta para `/admin/aluno/{id}` usando `window.location.assign`. Assim, ele sai da lista do painel admin e tenta abrir a página detalhada do aluno, em vez de acionar o painel lateral de opções (`UserProfileSheet`) que já existe no próprio `/admin`.

Plano de correção:

1. Ajustar a lista de usuários em `src/routes/admin.tsx`
   - Passar para cada linha de usuário uma função `onViewProfile`.
   - Essa função vai definir `selectedUserId` e abrir `sheetOpen`.

2. Trocar o comportamento do botão “Ver perfil”
   - Remover o `window.location.assign`.
   - Transformar o botão em uma ação local que abre o painel lateral com as opções do usuário.
   - Manter o rótulo “Ver perfil” para o admin acessar rapidamente cortesias, planos, bloqueio, reset, exclusão e relatórios.

3. Preservar a página completa do aluno
   - A rota `/admin/aluno/$id` continuará existindo para ver dashboard e cronogramas completos do aluno.
   - Se necessário, posso deixar essa navegação como uma ação separada dentro do painel lateral ou como outro botão “Dashboard”.

Resultado esperado:

- Ao clicar em **“Ver perfil”** no painel admin, abre imediatamente o painel lateral com as opções administrativas do usuário.
- O admin continua podendo acessar o dashboard e cronogramas completos do aluno pela página dedicada.