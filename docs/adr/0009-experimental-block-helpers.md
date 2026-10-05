# ADR 0009 — Experimental block helpers and `@index`

Consulted on 2026-10-04. Extends ADR 0002 without replacing its P1 baseline.

## Decision

The emission profile may list experimental block helpers beyond `each`, `if`, and `unless`, and the DSL may emit them when the site carries positional arguments and an optional hash. The first wave is `ifCond`, `hasSubStr`, `group`, and authoring-time `eq` (path plus literal). `formatDate` is an experimental inline helper. `@index` is an experimental path available only inside `each`.

Evidence stays `experimental` until Message Center records exist. A helper present in a private store project is not treated as verified VTEX capability. The local simulator remains a separate map; simulation alone does not authorize emission.

Block helpers that preserve context (`ifCond`, `hasSubStr`, `eq`) do not add a parent hop. `group` pushes an item context `{ index, value, items }` and uses the outer context in its fallback. Named argument `by` for `group` must be an identifier literal. `ifCond` accepts only `==`, `===`, and `!=` at compile time.

`compare`, `eval`, and `richShippingData` are not emitted. Store templates map `compare` inequalities to `ifCond`, show whole attachment fields instead of `eval` slices, and read order totals without shipping enrichment.

## Consequences

- `BlockName`, bind materialization, and path analysis grow to cover the new forms.
- Examples in `examples/basic-store` may use the new DSL components.
- Homologation cases document local contracts and Message Center gaps.
