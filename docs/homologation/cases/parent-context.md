# Parent context reference

Capability: `../`. Current state: `documented`. The path does not rise past the root. It does not unlock `@root`, `@index`, `@first`, `@last`, or `this`.

## Minimal template

Inside `{{#each items}}`, in [packages/react/golden-fixtures/components/item-line.tsx](../../../packages/react/golden-fixtures/components/item-line.tsx):

```tsx
<Vtex.Value path="../orderId" />
```

The artifact contains `{{../orderId}}`.

## Synthetic JSON

The same delivery fixture: `ORD-A` with two items and `ORD-B` with one. Each item has no own `orderId`; the identifier is on the parent order.

## Expected local result

In the `en-US` preview, observed by the test `packages/react/src/golden-path.test.tsx` on 2026-10-02, Node `24.21.0`, Windows:

- `>ORD-A</p>` appears twice
- `>ORD-B</p>` appears once

## Message Center

Follow [the manual procedure](../message-center.md). For each item, the visible identifier is that of the order for that item.

## Evidence

Resolved excerpt of the three items with the identifier beside them. Layer: Message Center.

## Approval

The two `ORD-A` items show `ORD-A` and the `ORD-B` item shows `ORD-B`. That parent path, in that nesting. Nothing beyond that.

## Divergence

Record which item showed which identifier. `../` remains `documented`.
