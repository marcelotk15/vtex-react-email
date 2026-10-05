# Each and nested loops

Capability: `each`. Current state: `verified` for Message Center runs of basic-store 01–03 with sanitized fixtures ([records](../records/basic-store-01-03-message-center.md)). The 2026-10-02 local proof on Node `24.21.0` on Windows showed emission and local evaluation only.

## Minimal template

```tsx
<Vtex.Each path="orders">
  <Vtex.Each path="items">
    <Text>
      <Vtex.Value path="name" />
    </Text>
  </Vtex.Each>
</Vtex.Each>
```

Real source: [packages/react/golden-fixtures/emails/order-confirmed.email.tsx](../../../packages/react/golden-fixtures/emails/order-confirmed.email.tsx). The artifact contains `{{#each orders}}` and `{{#each items}}`, balanced. `each` switches context to the item. The block fallback, when present, uses the outer context.

## Synthetic JSON

[packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json](../../../packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json): two orders. `ORD-A` has two items, `ORD-B` has one. It is not the VTEX event envelope.

## Expected local result

The `en-US` preview lists three items: Camisa, Meia, and Boné, in two contexts. The compiled artifact does not contain `ORD-A` or the names.

## Message Center

Follow [the manual procedure](../message-center.md) with the delivery fixture. Count items and confirm the second order does not reuse the first order's items.

## Evidence

Resolved HTML with the three names and indication of two orders. Layer: Message Center.

## Approval

Message Center: loops on 01–03 sanitized payloads with correct item counts ([records](../records/basic-store-01-03-message-center.md)). Local golden proof: three items and separate contexts. It does not unlock object iteration.

## Divergence

Record the observed count. Unseen iteration shapes stay outside the verified scope.
