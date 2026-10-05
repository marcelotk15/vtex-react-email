# ADR 0010 — Experimental `richShippingData`

Consulted on 2026-10-05. Extends ADR 0009.

## Decision

The emission profile may emit `{{#richShippingData shippingData}}…{{/richShippingData}}` as an experimental block. Evidence stays `experimental` until Message Center records exist. The local simulator clones `shippingData` before deriving fields and does not mutate the fixture or invent keys in JSON.

Inside the block the current context is the shipping object (item context). For each `logisticsInfo` entry the simulator selects the SLA whose `id` equals `selectedSla` and copies:

- `packageId` — concatenation of `sla.id`, `shippingEstimateDate`, and `shippingEstimate`
- `shippingEstimate`, `shippingEstimateDate`, `deliveryWindow`, `availableDeliveryWindows`
- `shippingEstimateDays` and `shippingEstimateDaysType` from a trailing `m`, `h`, `d`, or `bd` on the estimate string

Entries without a matching SLA keep their original fields. Items are sorted by numeric `shippingEstimateDays` with stable order within the same unit; mixed units remain a documented local limit.

Path analysis enriches the `logisticsInfo` element schema with those derived fields only under the `richShippingData` frame. Outside the block the contract stays the raw payload.

## Documented deviations from the official boilerplate

- Official templates group by `addessId` (typo). Migrations group by `addressId`.
- Official templates compare `item.length` inside `group`. Migrations compare `items.length` against the group item context `{ index, value, items }`.

## Consequences

- Store templates can keep logistics sections that depend on selected SLA fields.
- Composition from `group` alone is insufficient; emission of this helper is required for fidelity.
- `eval` remains unsupported.
