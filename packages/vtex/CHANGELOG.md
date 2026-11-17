# @vtex-email/vtex

## 0.4.0

### Minor Changes

- 54927f6: Support migrating hand-written Handlebars email templates:

  - Blocks can wrap table rows: anchors are located with the parse5 tokenizer instead of the tree builder, whose table rules moved or closed hosts between `<tr>` elements.
  - Paths accept Handlebars segment literals (`content.[Tipo Documento]`).
  - New experimental capabilities: `eval` (`Vtex.Eval`, emitted as `{{#eval "code" name=path}}{{/eval}}`) and `formatDiscount`. Inline helpers accept named arguments through `Vtex.Helper` `hash`.
  - `Vtex.attr` writes dynamic `href`/`src`/`alt`/`title` on any element.
  - `Email` accepts `head`, `htmlAttributes`, `bodyStyle`, `bodyTable`, and `doctype`.

- 54927f6: Message Center homologation and preview session fixes:

  - `each`, `if`, `unless`, `../`, `@index`, `formatCurrency`, `formatDate`, `eq`, and `ifCond` are now `verified` capabilities (records from Message Center runs), so builds no longer warn about them as unverified.
  - Preview: a partial rebuild that fails for one email keeps the emails that compiled, and fixture edits are reloaded even when a schema revalidation fails.
  - CLI: aligned with the new capability evidence.

### Patch Changes

- Updated dependencies [54927f6]
  - @vtex-email/core@0.4.0

## 0.3.0

### Minor Changes

- f3cd8e7: Expand experimental DSL and simulator for expression operands, dates, math, with, richShippingData, and composite attributes so official store templates can migrate under src/.

### Patch Changes

- Updated dependencies [f3cd8e7]
- Updated dependencies [f3cd8e7]
  - @vtex-email/core@0.3.0

## 0.2.0

### Minor Changes

- 479cb5f: Add experimental ifCond, hasSubStr, group, DSL eq, formatDate, and @index for Message Center authoring.

### Patch Changes

- Updated dependencies [479cb5f]
- Updated dependencies [479cb5f]
  - @vtex-email/core@0.2.0

## 0.1.0

### Minor Changes

- acc71e2: First public release of the VTEX Email toolchain.

### Patch Changes

- Updated dependencies [acc71e2]
  - @vtex-email/core@0.1.0
