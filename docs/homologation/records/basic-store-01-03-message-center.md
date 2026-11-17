# Message Center records: basic-store 01–03 (sanitized)

Layer for every record below: Message Center execution (not browser preview, not email client).

Templates: [01-confirmed](../../../examples/basic-store/src/emails/01-confirmed.email.tsx), [02-cancelled](../../../examples/basic-store/src/emails/02-cancelled.email.tsx), [03-payment-approved](../../../examples/basic-store/src/emails/03-payment-approved.email.tsx).

Fixtures: [01 sanitized](../../../examples/basic-store/src/fixtures/01-confirmed/sanitized-vtex.jsonc), [02 sanitized](../../../examples/basic-store/src/fixtures/02-cancelled/sanitized-vtex.jsonc), [03 sanitized](../../../examples/basic-store/src/fixtures/03-payment-approved/sanitized-vtex.jsonc).

Versions: profile `p0-message-center-experimental`, manifest `homologation: experimental`. Artifact from `vtex-email build` pasted into Message Center; JSON from the sanitized fixtures.

Date: 2026-10-05.

Available evidence: sanitized fixture paths above (no credentials, no real customer payload).

---

## each

- Case: nested-each / store loops
- Expected result: orders, transactions, payments, totals, and logistics items iterate with item context
- Observed result: loops resolve on 01–03 sanitized payloads with correct item counts
- State: `verified`

## if

- Case: conditionals
- Expected result: truthy paths (firstName, lastDigits, sellingPrice, totals value ≠ 0) take the positive branch
- Observed result: greeting, card last digits, priced items, and non-zero totals render; zero Discounts/Tax lines stay hidden
- State: `verified`

## unless

- Case: conditionals
- Expected result: falsy `split` shows the top-level payment block (01, 03)
- Observed result: payment section present when `split` is false or absent
- State: `verified` for that branch only (free-item `unless sellingPrice` not exercised)

## ../

- Case: parent-context
- Expected result: parent segments resolve for item matching and estimate paths (01, 02)
- Observed result: `../itemIndex`, `../split`, estimate and address parent climbs resolve
- State: `verified`

## @index

- Case: block-helpers
- Expected result: zero-based index inside `each` works with `eq` / `ifCond`
- Observed result: first logistics item and package item index matching on 01 and 02
- State: `verified` (not available inside `group` item context as index path — only inside `each`)

## formatCurrency

- Case: helpers
- Expected result: cents integers render as decimal without a currency symbol
- Observed result: Message Center showed pairs from sanitized fixtures — `24000` → `240,00`, `24500` → `245,00`, `500` → `5,00`, `196500` → `1965,00`, `197000` → `1970,00`
- State: `verified` for those pairs only

## formatDate

- Case: block-helpers
- Expected result: `shippingEstimateDate` formats as `dd/MM/yyyy` when `deliveryWindow` is absent (01)
- Observed result: estimate date branch rendered on 01-confirmed sanitized
- State: `verified` for `shippingEstimateDate` only (deliveryWindow branch not exercised)

## eq

- Case: locale + DSL
- Expected result: locale merge selects `pt-BR` document; DSL matches installments `1`, totals Items/Shipping, addressId and item id
- Observed result: Portuguese copy from merge on 01 and 03; at-sight payment and totals lines on sanitized payloads; item/address matching on 01 and 02
- State: `verified` for those uses (`en-US` merge branch and installments > 1 not exercised here)

## ifCond

- Case: block-helpers
- Expected result: operators `==` and `!=` against length, anonymous name, channel, and `@index`
- Observed result: one-product copy on 03; non-anonymous greeting; delivery channel and index checks on 01
- State: `verified` for `==` / `!=` only (operator `>` dead with single-item fixtures)

## group

- Case: block-helpers
- Expected result: logistics grouped by `packageId` / `addressId` with `{ index, value, items }`
- Observed result: package summary and package lists on 01 and 02
- State: `verified`

## richShippingData

- Case: block-helpers
- Expected result: shippingData becomes current context with derived SLA / package fields without mutating the fixture
- Observed result: shipping summary and packages on 01-confirmed and 02-cancelled
- State: `verified`

---

## Not promoted from these runs

| Capability                                                                                                | Reason                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `math`                                                                                                    | Emitted on 01 inside `items.length > 1`; single-item sanitized fixtures never run it |
| `hasSubStr`, `with`, `replace`, `formatTime`, `formatDateTime`                                            | Not used by templates 01–03                                                          |
| split true, pickup, deliveryWindow, installments > 1, free item, Discounts/Tax with value ≠ 0, `ifCond >` | Dead branches on these sanitized fixtures                                            |
