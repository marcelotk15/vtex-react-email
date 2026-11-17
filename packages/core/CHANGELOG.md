# @vtex-email/core

## 0.4.0

### Minor Changes

- 54927f6: Support migrating hand-written Handlebars email templates:

  - Blocks can wrap table rows: anchors are located with the parse5 tokenizer instead of the tree builder, whose table rules moved or closed hosts between `<tr>` elements.
  - Paths accept Handlebars segment literals (`content.[Tipo Documento]`).
  - New experimental capabilities: `eval` (`Vtex.Eval`, emitted as `{{#eval "code" name=path}}{{/eval}}`) and `formatDiscount`. Inline helpers accept named arguments through `Vtex.Helper` `hash`.
  - `Vtex.attr` writes dynamic `href`/`src`/`alt`/`title` on any element.
  - `Email` accepts `head`, `htmlAttributes`, `bodyStyle`, `bodyTable`, and `doctype`.

## 0.3.0

### Minor Changes

- f3cd8e7: Wrap DSL block regions in a compiler-owned vtx-anchor host and strip that host on restore so authors never forward data-anchor.
- f3cd8e7: Expand experimental DSL and simulator for expression operands, dates, math, with, richShippingData, and composite attributes so official store templates can migrate under src/.

## 0.2.0

### Minor Changes

- 479cb5f: Merge fixture meta and payload into a single `{ meta, data }` file and publish `fixture.schema.json` from core.
- 479cb5f: Add experimental ifCond, hasSubStr, group, DSL eq, formatDate, and @index for Message Center authoring.

## 0.1.0

### Minor Changes

- acc71e2: First public release of the VTEX Email toolchain.
