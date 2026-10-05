# Locale with eq, alias, and fallback

Capability: `eq` with literal (merge selector) and DSL `Vtex.Eq` (authoring). Current state: `verified` for Message Center runs of basic-store 01 and 03 with sanitized fixtures ([records](../records/basic-store-01-03-message-center.md)): merge selecting `pt-BR`, and DSL uses for installments `1`, totals Items/Shipping, and address/item match. The artifact manifest remains `homologation: experimental`; `eq` no longer emits `TARGET001`.

## Minimal template

Locale merge is not a component. It is the variant combination. In the official store emails under [examples/basic-store/src/emails](../../../examples/basic-store/src/emails):

```ts
i18n: {
  localePath: 'orders.0.clientPreferencesData.locale',
  output: 'merged',
  aliases: { 'pt-br': 'pt-BR' },
}
```

Example DSL emission of `eq` (authoring, separate from merge):

```tsx
<Vtex.Eq path="installments" value={1}>
  <Text>
    <Trans id="payment.atSight" />
  </Text>
</Vtex.Eq>
```

## Synthetic JSON

Payloads live under `examples/basic-store/src/fixtures/<email-id>/`. Sanitized Message Center samples use `pt-BR`. Locale aliases and fallbacks follow the merged artifact branches for `en-US` and `pt-BR` / `pt-br`.

## Expected local result

- `en-US` resolves the English document
- `pt-br`, missing, and unknown locales resolve the Portuguese document when configured that way
- forcing locale in preview alters the copy, not the fixture file
- the manifest remains `homologation: experimental`; `eq` is `verified` and does not emit `TARGET001`

## Message Center

Follow [the manual procedure](../message-center.md). Check the language of the resolved document, including the lowercase `pt-br` branch. Store records: [basic-store-01-03-message-center.md](../records/basic-store-01-03-message-center.md).

## Evidence

Excerpts in the store records. Layer: Message Center. The local preview does not fill these records.

## Approval

`eq` is `verified` for merge `pt-BR` on 01 and 03, and for the DSL uses exercised by the sanitized fixtures. `en-US` merge selection and installments > 1 remain outside this approval.

## Divergence

Record the locale sent and the language that came out. Do not normalize the alias only in preview, and do not silently swap the selector.
