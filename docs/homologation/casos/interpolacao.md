# Interpolação com caracteres especiais

Capacidade: interpolação escapada. Estado atual: `documented`. Resultado local abaixo veio de `pnpm proof` em 2026-10-02, Node `24.21.0`, `win32` `x64`, Handlebars `4.7.9`. Não muda o estado.

## Template mínimo

Trecho de [proof/emails/order-confirmed.email.tsx](../../../proof/emails/order-confirmed.email.tsx) e de [proof/components/item-line.tsx](../../../proof/components/item-line.tsx):

```tsx
<Trans id="common.hello" />{' '}
<Vtex.Value path="clientProfileData.firstName" />
<Vtex.Value path="name" />
```

O artefato emite `{{clientProfileData.firstName}}` e `{{name}}` com escaping do Handlebars. Não usar triplas chaves.

## JSON sintético

Primeiro pedido de [proof/fixtures/order-confirmed/delivery.json](../../../proof/fixtures/order-confirmed/delivery.json):

```json
{
  "clientProfileData": { "firstName": "Ana & \"Lia\" <João>" },
  "items": [{ "name": "Camisa & \"Azul\"" }]
}
```

Nomes fictícios. O objeto completo da fixture tem mais campos; o Message Center deve receber o arquivo inteiro, sem metadado de desenvolvimento misturado no JSON.

## Resultado local esperado

No documento resolvido em `en-US`:

- `Ana &amp; &quot;Lia&quot; &lt;João&gt;`
- `Camisa &amp; &quot;Azul&quot;`
- `João` permanece legível
- não aparece `&amp;amp;`

O build não contém `Ana &` cru. Isso mostra que a fixture não foi congelada.

## Message Center

Seguir [o procedimento manual](../message-center.md). No HTML resolvido, conferir o primeiro nome e o nome do item, não só o texto visível se a conta também mostrar o HTML.

## Evidência

Recorte do HTML resolvido com os dois trechos, no molde de [registro.md](../registro.md). Camada: Message Center.

## Aprovação

Os dois trechos iguais ao resultado local, Unicode legível, um único escaping. Só essa interpolação pode ser registrada. Não estende a outro contexto de escaping.

## Divergência

Anotar esperado, observado e se o desvio está no texto ou no HTML. A interpolação continua `documented`.
