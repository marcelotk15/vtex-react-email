# ADR 0009 — Experimental block helpers and `@index`

Consulted on 2026-10-04. Updated 2026-10-05 for expression operands, math, with, and dates. Extends ADR 0002 without replacing its P1 baseline.

## Decision

The emission profile may list experimental block helpers beyond `each`, `if`, and `unless`, and the DSL may emit them when the site carries positional arguments and an optional hash. Covered forms: `ifCond`, `hasSubStr`, `group`, `eq`, `with`, `math` (inline and block), and authoring-time dates `formatDate`, `formatTime`, `formatDateTime`. `@index` is an experimental path available only inside `each`. `richShippingData` is specified in ADR 0010.

Evidence stays `experimental` until Message Center records exist. A helper present in a private store project is not treated as verified VTEX capability. The local simulator remains a separate map; simulation alone does not authorize emission.

Profile argument kinds are `path`, `literal`, or `expression` (path or literal). Validation lives in bind materialization. DSL components pass `expr.path` and `expr.literal`; string `value` props remain literal sugar.

Block helpers that preserve context (`ifCond`, `hasSubStr`, `eq`) do not add a parent hop. `with` pushes the object on the positive branch and uses the outer context in its fallback. `group` pushes `{ index, value, items }` and uses the outer context in its fallback. Named argument `by` for `group` must be an identifier literal. `ifCond` accepts `==`, `===`, `!=`, `<`, `<=`, `>`, and `>=`. `eq`, `hasSubStr`, and `replace` accept expression operands. `math` accepts expression operands and operators `+ - * / %`.

Path analysis treats `@index` as a loop index, `array.length` as a virtual number on arrays, and keeps the call-site frame when `each` targets a parent path so `../` climbs the Handlebars stack.

`compare` is not emitted as a helper name; official templates map it to `ifCond`. `eval` is not emitted.

## Consequences

- `BlockName`, bind materialization, and path analysis grow to cover the new forms.
- Examples in `examples/basic-store/src` may use the new DSL components.
- Homologation cases document local contracts and Message Center gaps.
