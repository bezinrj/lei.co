# Loja — cards menores e destaque reforçado

## Objetivo

- Reduzir o tamanho dos cards de produto da grade para um visual mais compacto.
- Reforçar o destaque do card que aparece no banner do topo (o `destaque`), para criar contraste visual claro entre ele e a grade.

## Mudanças em `src/routes/loja.tsx`

### 1. Grid mais denso (cards menores)

Hoje:
```
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3   gap-3.5
```

Novo:
```
grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5   gap-3
```

Isso já reduz a largura de cada card sem mexer no conteúdo interno.

### 2. `ProdutoCard` mais compacto

- Imagem: trocar `aspect-ratio 1 / 1` por `4 / 3` (menos altura).
- Emoji placeholder: `text-[36px]` → `text-[28px]`.
- Padding interno do bloco de texto: reduzir (`p-3` → `p-2.5`), gap menor.
- Nome: `text-[13px]` / `line-clamp-2`.
- Descrição: ocultar em telas menores; manter `line-clamp-2` quando exibida (ou remover de vez do card para deixar só nome + preço + CTA).
- Preço: `text-[15px]` (em vez do tamanho atual).
- Botão "Comprar": pílula menor (`px-3 py-1.5 text-[11px]`), ícone 10px.
- Badges no canto da imagem: já são pequenos; manter, apenas garantir `gap-0.5`.

Resultado: card visivelmente menor, ainda legível, com hierarquia nome → preço → CTA.

### 3. `ProdutoDestaque` mais imponente (banner do topo)

Para criar contraste com a grade compacta:

- Altura mínima: `minHeight: 200` → `minHeight: 260` (desktop).
- Imagem lateral: `md:w-[280px]` → `md:w-[360px]`, `h-[180px]` → `h-[220px]` no mobile.
- Borda/sombras: adicionar `boxShadow: 0 8px 28px -12px rgba(29,158,117,0.25)` e `border` levemente mais marcada.
- Badge fixa "⭐ Destaque da semana" no canto superior esquerdo da imagem (sobreposta), mesmo que o produto não tenha o badge `destaque` ativo.
- Nome: `text-[20px]` → `text-[26px]`, mais peso visual.
- Preço: `text-[22px]` → `text-[28px]`.
- Botão "Comprar agora": maior (`px-7 py-3 text-[13px]`), com leve gradiente verde (`linear-gradient(135deg,#1D9E75,#0F7A5C)`).
- Margem inferior do bloco aumenta (`mb-4` → `mb-6`) para separar bem do grid.

### 4. `AdicionarProdutoCard` (admin)

Ajustar para a mesma proporção `4 / 3` do novo `ProdutoCard`, mantendo o estilo tracejado.

## Fora do escopo

- Sem mudanças no schema, queries, lógica de filtros, mutations ou form admin.
- Sem alteração na ordem dos produtos nem nas regras de qual produto vira `destaque`.
- Sem mudança no comportamento mobile do menu/AppShell.
