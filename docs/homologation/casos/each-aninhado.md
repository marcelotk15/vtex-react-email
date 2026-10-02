# Each e loops aninhados

Capacidade: `each`. Estado atual: `documented`. A prova de 2026-10-02 no Node `24.21.0` em Windows mostrou a emissão e a avaliação local. Não muda o estado.

## Template mínimo

```tsx
<Vtex.Each path="orders">
  <Vtex.Each path="items">
    <Text>
      <Vtex.Value path="name" />
    </Text>
  </Vtex.Each>
</Vtex.Each>
```

Fonte real: [proof/emails/order-confirmed.email.tsx](../../../proof/emails/order-confirmed.email.tsx). O artefato contém `{{#each orders}}` e `{{#each items}}`, balanceados. O `each` troca o contexto para o item. O fallback do bloco, quando existe, usa o contexto externo.

## JSON sintético

[proof/fixtures/order-confirmed/delivery.json](../../../proof/fixtures/order-confirmed/delivery.json): dois pedidos. `ORD-A` tem dois itens, `ORD-B` tem um. Não é o envelope do evento VTEX.

## Resultado local esperado

O preview em `en-US` lista três itens: Camisa, Meia e Boné, em dois contextos. O artefato compilado não contém `ORD-A` nem os nomes.

## Message Center

Seguir [o procedimento manual](../message-center.md) com a fixture de entrega. Contar itens e conferir que o segundo pedido não reutiliza os itens do primeiro.

## Evidência

HTML resolvido com os três nomes e a indicação de dois pedidos. Camada: Message Center.

## Aprovação

Três itens e contextos separados, na mesma contagem do resultado local. Não libera iteração de objeto.

## Divergência

Registrar a contagem observada. `each` continua `documented`.
