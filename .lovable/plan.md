# Sugestão de compra de cronogramas premium para todos

## Diagnóstico

A página `/meu-plano` já tem uma seção "Cronogramas Premium — compra individual", e a `/cronogramas` poderia exibir os premium como cards bloqueados. Mas atualmente **nenhum dos dois aparece para alunos comuns**, porque a política de RLS de SELECT em `cronogramas` esconde os originais premium de quem não é admin/mod (foi assim que bloqueamos para evitar que alunos abrissem a matriz original).

Resultado prático hoje:
- Aluno entra em `/meu-plano` → seção "Cronogramas Premium" aparece vazia.
- Aluno entra em `/cronogramas` → só vê gratuitos, sua cópia pessoal e suas cópias premium já adquiridas.

## Solução

A regra correta é: **todo mundo pode VER que um cronograma premium existe** (catálogo/vitrine), mas só quem tem acesso pode abrir a matriz (matérias/tópicos). Isso já está garantido pelas policies de `cronograma_materias` e `cronograma_topicos`, que checam `tem_acesso_cronograma`. Então é seguro liberar SELECT do "card" do cronograma para todos os autenticados.

### 1. Migração de banco

Substituir a policy `Cronogramas viewable by allowed users` para também permitir SELECT de cronogramas premium originais (`is_proprio = false AND premium = true AND origem_id IS NULL`) a todos os autenticados — sem mexer no acesso à matriz.

A nova política terá estes ramos:
- admin/mod veem tudo
- dono vê seus próprios (`is_proprio = true AND criado_por = auth.uid()`)
- todos veem institucionais gratuitos (`is_proprio = false AND premium = false`)
- **novo:** todos veem premium originais (`is_proprio = false AND premium = true AND origem_id IS NULL`) — para vitrine

### 2. `/meu-plano`

Nenhuma mudança de código: a seção já existe e passa a ser populada automaticamente assim que o RLS liberar.

### 3. `/cronogramas`

Adicionar uma nova seção **"Cronogramas Premium"** (logo abaixo de "Meu Cronograma" e "Meus Cronogramas Premium", antes das categorias institucionais), exibindo os premium originais para os quais o usuário **ainda não tem cópia/acesso**. Comportamento por card:

- Mostrado como "bloqueado" (cadeado), reutilizando o `CategoryRow` com `isLocked` retornando `true`.
- Ao clicar, em vez de navegar para o cronograma, abrir o `UpgradeModal` existente (já é o caminho atual quando `tem_acesso_cronograma` é falso) — então basta usar `handleSelect` que já trata isso.
- Admin/mod continuam vendo os premium originais na seção institucional usual (com ações de edição); para eles a seção "Cronogramas Premium" de vitrine não aparece (evita duplicidade).

Filtro JS:
```ts
const premiumVitrine = items.filter(c =>
  !c.is_proprio && c.premium && !c.origem_id &&
  !isAdminOrMod &&
  !minhasCopiasPremium.some(cp => cp.origem_id === c.id)
);
```

E ajustar `institucionais` para que admin/mod continue vendo os originais premium ali, mas alunos comuns não (já está parcialmente assim).

## Detalhes técnicos

- Arquivos alterados:
  - Nova migração SQL: `DROP POLICY` + `CREATE POLICY` em `public.cronogramas` para SELECT.
  - `src/routes/cronogramas.tsx`: novo filtro `premiumVitrine` + novo `<CategoryRow title="Cronogramas Premium" ... isLocked={() => true} />`.
- Sem mudanças em server functions, hooks ou tipos.
- A matriz (matérias/tópicos) continua protegida — alunos só veem nome, categoria, imagem e preço do premium.
