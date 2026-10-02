# Referência ao contexto pai

Capacidade: `../`. Estado atual: `documented`. O path não sobe além da raiz. Não libera `@root`, `@index`, `@first`, `@last` nem `this`.

## Template mínimo

Dentro de `{{#each items}}`, em [proof/components/item-line.tsx](../../../proof/components/item-line.tsx):

```tsx
<Vtex.Value path="../orderId" />
```

O artefato contém `{{../orderId}}`.

## JSON sintético

A mesma fixture de entrega: `ORD-A` com dois itens e `ORD-B` com um. Cada item não tem `orderId` próprio; o identificador está no pedido pai.

## Resultado local esperado

No preview em `en-US`, observado por `pnpm proof` em 2026-10-02, Node `24.21.0`, Windows:

- `>ORD-A</p>` aparece duas vezes
- `>ORD-B</p>` aparece uma vez

## Message Center

Seguir [o procedimento manual](../message-center.md). Para cada item, o identificador visível é o do pedido daquele item.

## Evidência

Recorte resolvido dos três itens com o identificador ao lado. Camada: Message Center.

## Aprovação

Os dois itens de `ORD-A` mostram `ORD-A` e o item de `ORD-B` mostra `ORD-B`. Esse path pai, nesse aninhamento. Nada além disso.

## Divergência

Registrar qual item mostrou qual identificador. `../` continua `documented`.
