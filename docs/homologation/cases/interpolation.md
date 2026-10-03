# Interpolation with special characters

Capability: escaped interpolation. Current state: `documented`. The local result below came from the test `packages/react/src/golden-path.test.tsx` on 2026-10-02, Node `24.21.0`, `win32` `x64`, Handlebars `4.7.9`. It does not change the state.

## Minimal template

Excerpt from [packages/react/golden-fixtures/emails/order-confirmed.email.tsx](../../../packages/react/golden-fixtures/emails/order-confirmed.email.tsx) and [packages/react/golden-fixtures/components/item-line.tsx](../../../packages/react/golden-fixtures/components/item-line.tsx):

```tsx
<Trans id="common.hello" />{' '}
<Vtex.Value path="clientProfileData.firstName" />
<Vtex.Value path="name" />
```

The artifact emits `{{clientProfileData.firstName}}` and `{{name}}` with Handlebars escaping. Do not use triple braces.

## Synthetic JSON

First order from [packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json](../../../packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json):

```json
{
  "clientProfileData": { "firstName": "Ana & \"Lia\" <João>" },
  "items": [{ "name": "Camisa & \"Azul\"" }]
}
```

Fictional names. The full fixture object has more fields; Message Center should receive the whole file, without development metadata mixed into the JSON.

## Expected local result

In the resolved `en-US` document:

- `Ana &amp; &quot;Lia&quot; &lt;João&gt;`
- `Camisa &amp; &quot;Azul&quot;`
- `João` remains readable
- `&amp;amp;` does not appear

The build does not contain raw `Ana &`. That shows the fixture was not frozen.

## Message Center

Follow [the manual procedure](../message-center.md). In the resolved HTML, check the first name and the item name, not only the visible text if the account also shows the HTML.

## Evidence

Excerpt of the resolved HTML with both fragments, in the [record.md](../record.md) template. Layer: Message Center.

## Approval

Both fragments match the local result, readable Unicode, a single escaping. Only that interpolation may be recorded. It does not extend to another escaping context.

## Divergence

Note expected, observed, and whether the deviation is in the text or the HTML. Interpolation remains `documented`.
