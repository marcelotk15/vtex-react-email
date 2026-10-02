# If, unless e alternativas

Capacidades: `if` e `unless`. Estado atual: `documented`. Truthiness é a do Handlebars: `0`, string vazia e array vazio são falsos. Os dois ramos conservam o contexto. A prova local não substitui `if` por `Boolean()` do JavaScript.

## Template mínimo

Endereço, em [proof/emails/order-confirmed.email.tsx](../../../proof/emails/order-confirmed.email.tsx):

```tsx
<Vtex.If
  fallback={
    <Text>
      <Trans id="order.pickup" />
    </Text>
  }
  path="shippingData.address"
>
  <Text>
    <Vtex.Value path="shippingData.address.street" />
  </Text>
</Vtex.If>
```

Código, em [examples/basic-store/emails/auth-code.email.tsx](../../../examples/basic-store/emails/auth-code.email.tsx):

```tsx
<Vtex.Unless path="expired">
  <Text>
    <Trans id="auth.active" />
  </Text>
</Vtex.Unless>
```

O artefato do pedido contém `{{#if shippingData.address}}` e `{{else}}`. O de autenticação contém `{{#unless expired}}` e não emite `eq`, porque a saída é `per-locale`.

## JSON sintético

- Entrega: [proof/fixtures/order-confirmed/delivery.json](../../../proof/fixtures/order-confirmed/delivery.json), com rua.
- Retirada: [proof/fixtures/order-confirmed/pickup.json](../../../proof/fixtures/order-confirmed/pickup.json), sem `shippingData`.
- Autenticação: [examples/basic-store/fixtures/auth-code/default.json](../../../examples/basic-store/fixtures/auth-code/default.json), `"expired": false`, código `AUTH-KEEP`. O código não pode aparecer congelado no artefato.

## Resultado local esperado

Observado por `pnpm proof` em 2026-10-02, Node `24.21.0`, Windows, no documento resolvido:

- entrega em `en-US` contém `Rua São João 10` e `Avenida Central`
- retirada, locale ausente, contém `Retirada na loja` e não contém `Rua São João`
- com `expired: false`, o ramo do `unless` permanece, então o texto de catálogo `Ainda válido` ou `Still valid` entra na variante daquele idioma

Array vazio não está na fixture da prova. Se um caso futuro usar fallback de `each` com array vazio, a aprovação vale só para esse fallback, no contexto externo.

## Message Center

Seguir [o procedimento manual](../message-center.md) três vezes, um JSON por vez, sem misturar os resultados no mesmo registro.

## Evidência

Três recortes: endereço presente, alternativa de retirada, ramo ativo do `unless`. Camada: Message Center.

## Aprovação

Cada comportamento aprovado no seu registro. Presença da rua não aprova a alternativa. `unless` com falso não aprova um `expired: true`.

## Divergência

Registrar qual ramo apareceu. `if` e `unless` continuam `documented`.
