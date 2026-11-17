# If, unless, and alternatives

Capabilities: `if` and `unless`. Current state: `verified` for Message Center runs of basic-store 01–03 with sanitized fixtures ([records](../records/basic-store-01-03-message-center.md)): truthy `if` branches (firstName, lastDigits, sellingPrice, non-zero totals) and falsy `split` under `unless` (01, 03). Truthiness is Handlebars truthiness: `0`, empty string, and empty array are false. Both branches keep context. The local proof does not replace `if` with JavaScript `Boolean()`.

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

Code, in [packages/react/golden-fixtures/emails/auth-code.email.tsx](../../../packages/react/golden-fixtures/emails/auth-code.email.tsx):

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
- Auth: synthetic payload in `packages/react/src/template-reuse.test.tsx`, `"expired": false`, code `SECRET-CODE`. The code must not appear frozen in the artifact.

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

Store sanitized Message Center records cover the exercised `if` / `unless` branches above. Street presence does not approve the pickup alternative. `unless` with falsy `split` does not approve `expired: true` or free-item `unless sellingPrice`.

## Divergence

Record which branch appeared. Unexercised branches stay outside the verified scope.
