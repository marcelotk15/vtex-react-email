# Full email with synthetic payload

This case gathers, in a single template, the behaviors of the cases under [cases/](cases/). It does not replace the record for each behavior. What this payload does not exercise stays out of scope.

The JSON is synthetic. [packages/react/golden-fixtures/fixtures/order-confirmed/delivery.meta.json](../../packages/react/golden-fixtures/fixtures/order-confirmed/delivery.meta.json) already states it is not the real VTEX envelope. Using it in Message Center does not confirm the event contract.

## Template

[packages/react/golden-fixtures/emails/order-confirmed.email.tsx](../../packages/react/golden-fixtures/emails/order-confirmed.email.tsx), with [packages/react/golden-fixtures/components/item-line.tsx](../../packages/react/golden-fixtures/components/item-line.tsx). There are two languages, `pt-BR` and `en-US`, selected by `orders.0.clientPreferencesData.locale`. The proof combines the documents with `eq`. The store example adds the `pt-br` alias; the full proof, the one that produces the strings below, does not declare that alias. The alias belongs to the locale case.

The template includes nested `each`, `../orderId`, `if` with alternative, `formatCurrency`, `replace`, dynamic `src`, `alt`, and `href`, and text with `&`, quotes, and Unicode.

## JSON

- Delivery, multiple items, special characters, prices `20000`, `0`, and `1500`, remote images: [packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json](../../packages/react/golden-fixtures/fixtures/order-confirmed/delivery.json).
- Pickup, no address, missing locale, fallback text: [packages/react/golden-fixtures/fixtures/order-confirmed/pickup.json](../../packages/react/golden-fixtures/fixtures/order-confirmed/pickup.json).

The extra `sellerNote` field on delivery is preserved by the schema's loose shape and is not consumed by the template. That does not describe the real envelope.

## Expected local result

The test `packages/react/src/golden-path.test.tsx` passed on 2026-10-02, Node `24.21.0`, `win32` `x64`, Handlebars `4.7.9`, `@react-email/components` `1.0.12`, Tailwind `4.1.18`, profile `p0-message-center-experimental`, manifest `homologation: experimental`.

In the artifact: loops, `../`, `if`/`else`, `formatCurrency`, `replace`, `@media`, `sm_p-4`, and `<!--[if mso]>` comment. No frozen fixture, no precomputed `200,00`, no script, and no internal token.

In the English delivery preview: three items, `ORD-A` twice and `ORD-B` once, escaping of `Ana & "Lia" <João>`, image URLs with `&#x3D;` in the query, `200,00`, `0,00`, `8 business days`, `3 business days`, streets present, a single document, title `Order confirmed`.

In the pickup preview: title `Pedido confirmado`, text `Retirada na loja`, without the delivery street, a single document.

`1500` is in the JSON. The proof did not assert the string `15,00`. Negative is not in the JSON. Client-blocked images were not executed.

## Message Center

Follow [the manual procedure](message-center.md) with the proof's combined source, first with delivery and then with pickup. Do not send.

## Evidence

Two records, delivery and pickup, in the [record.md](record.md) template. Inside each, note which behaviors from this file appeared. A full-email record does not mark the profile as homologated and does not mark a behavior the excerpt does not show.

## Approval

The seen excerpts match the local result, and the account accepts the source. Each capability still has the criterion from its specific case.

## Divergence

Record the excerpt. If the refusal is of the combined source, use the single-document case and keep `per-locale` as the explicit alternative.
