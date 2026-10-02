# formatCurrency e replace

Estados atuais: os dois são `documented`. O par de moeda que a documentação VTEX cobre, e que a prova local usa como critério de destino, é `20000` para `200,00`, sem símbolo. `replace` é uma ocorrência, path mais dois literais, como `8bd`.

O simulador local faz a mesma conta de centavos para outros inteiros. Isso não é paridade com a VTEX. Zero, `1500` e negativo ficam como observação do simulador.

## Template mínimo

Em [proof/components/item-line.tsx](../../../proof/components/item-line.tsx):

```tsx
<Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />
<Vtex.Helper
  args={[expr.path('shippingEstimate'), expr.literal('bd'), expr.literal(' business days')]}
  name="replace"
/>
```

O artefato contém `{{formatCurrency sellingPrice}}` e `{{replace shippingEstimate "bd" " business days"}}`. O build não contém `20000` nem `200,00`.

## JSON sintético

Itens de [proof/fixtures/order-confirmed/delivery.json](../../../proof/fixtures/order-confirmed/delivery.json):

- `20000` e `8bd` em dois itens
- `0` e `8bd` em um item
- `1500` e `3bd` no pedido `ORD-B`

Não há valor negativo nessa fixture.

## Resultado local esperado

`pnpm proof` em 2026-10-02, Node `24.21.0`, Windows, no preview `en-US`, conferiu:

- `200,00`
- `0,00`
- `8 business days`
- `3 business days`

O simulador, para um inteiro, separa o sinal, divide o módulo por 100 e completa dois dígitos de centavos. Por essa definição, `1500` vira `15,00` e `-20000` vira `-200,00`. A prova não afirmou a string `15,00` nem executou negativo. Esses pares não entram no critério de destino.

## Message Center

Seguir [o procedimento manual](../message-center.md). Ler o HTML resolvido nos valores. O símbolo `R$` do exemplo é texto estático, não efeito do helper.

## Evidência

Recorte com `200,00` e com uma substituição `8 business days`. Se `0,00`, `15,00` ou um negativo aparecerem, registrar como observação, em registros separados.

## Aprovação

Só o par `20000` para `200,00`, sem símbolo, e a substituição de uma ocorrência no formato documentado. Cada um no próprio registro. Os demais números continuam observação local.

## Divergência

Registrar o número enviado e o texto devolvido. O helper continua `documented` para o par visto, e o resto não sobe por extensão.
