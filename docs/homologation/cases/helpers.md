# formatCurrency and replace

Current states: `formatCurrency` is `verified` for Message Center pairs from basic-store sanitized fixtures 01–03 ([records](../records/basic-store-01-03-message-center.md)): `24000`, `24500`, `500`, `196500`, `197000` without a symbol. `replace` remains `documented`. The older VTEX documentation pair `20000` → `200,00` is still the local golden criterion; it was not the sanitized Message Center sample set.

Experimental block helpers (`hasSubStr`, `math`, `with`), and unverified date helpers (`formatTime`, `formatDateTime`) are covered in [block-helpers.md](./block-helpers.md). `ifCond`, `group`, `eq`, `formatDate`, and `@index` are `verified` in the scoped records linked above.

The local simulator does the same cents math for other integers. That is not automatic parity with VTEX beyond the verified pairs. Zero, `1500`, and negative remain simulator observations unless separately recorded.

## Minimal template

In [packages/react/golden-fixtures/components/item-line.tsx](../../../packages/react/golden-fixtures/components/item-line.tsx):

```tsx
<Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />
<Vtex.Helper
  args={[expr.path('shippingEstimate'), expr.literal('bd'), expr.literal(' business days')]}
  name="replace"
/>
```

The artifact contains `{{formatCurrency sellingPrice}}` and `{{replace shippingEstimate "bd" " business days"}}`. The build does not contain frozen currency strings.

## Synthetic JSON

Items from [packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json](../../../packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json):

- `20000` and `8bd` on two items
- `0` and `8bd` on one item
- `1500` and `3bd` on order `ORD-B`

Store Message Center samples: [01](../../../examples/basic-store/src/fixtures/01-confirmed/sanitized-vtex.jsonc), [02](../../../examples/basic-store/src/fixtures/02-cancelled/sanitized-vtex.jsonc), [03](../../../examples/basic-store/src/fixtures/03-payment-approved/sanitized-vtex.jsonc) sanitized fixtures.

There is no negative value in those fixtures.

## Expected local result

The test `packages/react/src/golden-path.test.tsx` on 2026-10-02, Node `24.21.0`, Windows, in the `en-US` preview, checked:

- `200,00`
- `0,00`
- `8 business days`
- `3 business days`

The simulator, for an integer, separates the sign, divides the absolute value by 100, and pads two cent digits. By that definition, `1500` becomes `15,00` and `-20000` becomes `-200,00`. The proof did not assert the string `15,00` and did not run a negative. Those pairs are not in the verified Message Center set.

## Message Center

Follow [the manual procedure](../message-center.md). Read the resolved HTML for the values. The example `R$` symbol is static text, not a helper effect. Store records live in [basic-store-01-03-message-center.md](../records/basic-store-01-03-message-center.md).

## Evidence

Store sanitized excerpts for the pairs listed under Approval. Golden `200,00` / `replace` remain separate local observations until their own Message Center records.

## Approval

`formatCurrency`: verified pairs `24000`, `24500`, `500`, `196500`, `197000` from sanitized 01–03. `replace`: still `documented` only. Other numbers do not rise by extension.

## Divergence

Record the number sent and the text returned. Do not promote unseen pairs.
