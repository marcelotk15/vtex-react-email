# formatCurrency and replace

Current states: both are `documented`. The currency pair that VTEX documentation covers, and that the local proof uses as the target criterion, is `20000` to `200,00`, without a symbol. `replace` is one occurrence, path plus two literals, as in `8bd`.

Experimental block helpers (`ifCond`, `hasSubStr`, `group`), DSL `eq`, `formatDate`, and `@index` are covered in [block-helpers.md](./block-helpers.md).

The local simulator does the same cents math for other integers. That is not parity with VTEX. Zero, `1500`, and negative remain simulator observations.

## Minimal template

In [packages/react/golden-fixtures/components/item-line.tsx](../../../packages/react/golden-fixtures/components/item-line.tsx):

```tsx
<Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />
<Vtex.Helper
  args={[expr.path('shippingEstimate'), expr.literal('bd'), expr.literal(' business days')]}
  name="replace"
/>
```

The artifact contains `{{formatCurrency sellingPrice}}` and `{{replace shippingEstimate "bd" " business days"}}`. The build does not contain `20000` or `200,00`.

## Synthetic JSON

Items from [packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json](../../../packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json):

- `20000` and `8bd` on two items
- `0` and `8bd` on one item
- `1500` and `3bd` on order `ORD-B`

There is no negative value in that fixture.

## Expected local result

The test `packages/react/src/golden-path.test.tsx` on 2026-10-02, Node `24.21.0`, Windows, in the `en-US` preview, checked:

- `200,00`
- `0,00`
- `8 business days`
- `3 business days`

The simulator, for an integer, separates the sign, divides the absolute value by 100, and pads two cent digits. By that definition, `1500` becomes `15,00` and `-20000` becomes `-200,00`. The proof did not assert the string `15,00` and did not run a negative. Those pairs are not in the target criterion.

## Message Center

Follow [the manual procedure](../message-center.md). Read the resolved HTML for the values. The example `R$` symbol is static text, not a helper effect.

## Evidence

Excerpt with `200,00` and one `8 business days` substitution. If `0,00`, `15,00`, or a negative appear, record them as observations in separate records.

## Approval

Only the pair `20000` to `200,00`, without a symbol, and the one-occurrence substitution in the documented form. Each in its own record. Other numbers remain local observation.

## Divergence

Record the number sent and the text returned. The helper stays `documented` for the seen pair, and the rest does not rise by extension.
