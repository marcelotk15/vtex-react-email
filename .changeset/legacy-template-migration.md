---
'@vtex-email/core': minor
'@vtex-email/vtex': minor
'@vtex-email/react': minor
---

Support migrating hand-written Handlebars email templates:

- Blocks can wrap table rows: anchors are located with the parse5 tokenizer instead of the tree builder, whose table rules moved or closed hosts between `<tr>` elements.
- Paths accept Handlebars segment literals (`content.[Tipo Documento]`).
- New experimental capabilities: `eval` (`Vtex.Eval`, emitted as `{{#eval "code" name=path}}{{/eval}}`) and `formatDiscount`. Inline helpers accept named arguments through `Vtex.Helper` `hash`.
- `Vtex.attr` writes dynamic `href`/`src`/`alt`/`title` on any element.
- `Email` accepts `head`, `htmlAttributes`, `bodyStyle`, `bodyTable`, and `doctype`.
