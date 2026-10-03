# If, unless, and alternatives

Capabilities: `if` and `unless`. Current state: `documented`. Truthiness is Handlebars truthiness: `0`, empty string, and empty array are false. Both branches keep context. The local proof does not replace `if` with JavaScript `Boolean()`.

## Minimal template

Address, in [packages/react/golden-fixtures/emails/order-confirmed.email.tsx](../../../packages/react/golden-fixtures/emails/order-confirmed.email.tsx):

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

Code, in [examples/basic-store/emails/auth-code.email.tsx](../../../examples/basic-store/emails/auth-code.email.tsx):

```tsx
<Vtex.Unless path="expired">
  <Text>
    <Trans id="auth.active" />
  </Text>
</Vtex.Unless>
```

The order artifact contains `{{#if shippingData.address}}` and `{{else}}`. The auth one contains `{{#unless expired}}` and does not emit `eq`, because output is `per-locale`.

## Synthetic JSON

- Delivery: [packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json](../../../packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json), with street.
- Pickup: [packages/react/golden-fixtures/fixtures/order-confirmed/pickup.json](../../../packages/react/golden-fixtures/fixtures/order-confirmed/pickup.json), without `shippingData`.
- Auth: [examples/basic-store/fixtures/auth-code/default.json](../../../examples/basic-store/fixtures/auth-code/default.json), `"expired": false`, code `AUTH-KEEP`. The code must not appear frozen in the artifact.

## Expected local result

Observed by the test `packages/react/src/golden-path.test.tsx` on 2026-10-02, Node `24.21.0`, Windows, in the resolved document:

- `en-US` delivery contains `Rua São João 10` and `Avenida Central`
- pickup, missing locale, contains `Retirada na loja` and does not contain `Rua São João`
- with `expired: false`, the `unless` branch remains, so the catalog text `Ainda válido` or `Still valid` enters that language's variant

Empty array is not in the proof fixture. If a future case uses `each` fallback with an empty array, approval applies only to that fallback, in the outer context.

## Message Center

Follow [the manual procedure](../message-center.md) three times, one JSON at a time, without mixing results in the same record.

## Evidence

Three excerpts: address present, pickup alternative, active `unless` branch. Layer: Message Center.

## Approval

Each approved behavior in its own record. Street presence does not approve the alternative. `unless` with false does not approve `expired: true`.

## Divergence

Record which branch appeared. `if` and `unless` remain `documented`.
