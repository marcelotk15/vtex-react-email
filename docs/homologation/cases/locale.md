# Locale with eq, alias, and fallback

Capability: `eq` with literal (merge selector) and DSL `Vtex.Eq` (authoring). Current state: `experimental`. The reference VTEX documentation compares two paths for some cases; the literal selector in locale merge is a local simulator until Message Center. The DSL also emits `eq` for store templates (for example payment installments and item matching).

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

Payloads live under `examples/basic-store/src/fixtures/<email-id>/`. All synthetic. Locale aliases and fallbacks follow the merged artifact branches for `en-US` and `pt-BR` / `pt-br`.

## Expected local result

- `en-US` resolves the English document
- `pt-br`, missing, and unknown locales resolve the Portuguese document when configured that way
- forcing locale in preview alters the copy, not the fixture file
- the manifest remains `homologation: experimental` and emits `TARGET001` for `eq`

## Message Center

Follow [the manual procedure](../message-center.md). Check the language of the resolved document, including the lowercase `pt-br` branch.

## Evidence

Excerpts in the [record.md](../record.md) template. Layer: Message Center. The local preview does not fill these records.

## Approval

`eq` stays `experimental` until Message Center accepts the merge selector and the DSL uses. Until then it remains `experimental`.

## Divergence

Record the locale sent and the language that came out. Do not normalize the alias only in preview, and do not silently swap the selector.
