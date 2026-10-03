# P0 proof evidence

Local close-out on 2026-10-01. `process.version` `v24.21.0`, platform `win32` `x64`. The proof measures the compiler in that run. It does not homologate Message Center, Gmail, Outlook, Linux, or macOS.

Commands that passed on this machine:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

The golden path in `packages/react/src/golden-path.test.tsx` (fixtures in `packages/react/golden-fixtures/`) compiles the confirmation template and evaluates both fixtures through the Node API. It does not start a server and is not the CLI from RFC section 17.

## What the React Email source proves

Read in `@react-email/tailwind@2.0.7` and `@react-email/button@0.2.1`:

- `mapReactTree` calls a custom component as a function. That breaks hooks. P0 registers compilation in `AsyncLocalStorage`, without React Context.
- `Body`, `Button`, `Img`, `Link`, and `Text` enter the native-element list. `Head` and `Row` are expanded.
- There are two passes, collect and inline. A simple class becomes `style`. A media-query class stays on the element with a sanitized name (`sm:p-4` becomes `sm_p-4`) and the rule goes into `<style>` inside `<head>`.
- Inlining does `{ ...tailwindStyles, ...existingStyle }`. The prior `style` wins.
- The `Button` child appears once. The `<!--[if mso]>` comments insert spacers without copying the child.
- `setupTailwind` keeps a global `Map` `promiseStates` keyed by config. Compilations with the same config share setup.

## What the local probe measured

File: `packages/react/src/render-probe.test.tsx`. `pretty: false`.

| Case                                                   | Measurement                                                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Component with internal class                          | Called once. `text-sm` appears as `14px`.                                                                                                 |
| Tokens in `td`, `href`, `src`, `alt`, and button child | Remain intact in the rendered string.                                                                                                     |
| Text inside `Text`                                     | The immediate parent in parse5 is `p`, because `Text` renders a paragraph.                                                                |
| Text sibling of `<tr>`                                 | Remains in the string, but parse5 places it in `td`. The parent is no longer `tbody`.                                                     |
| `Button` child                                         | One copy. The MSO spacer does not cut the token.                                                                                          |
| Class `sm:p-4`                                         | `<style>` contains `@media` and the element keeps `sm_p-4`.                                                                               |
| Fixture sentinel                                       | Absent from the compiled HTML.                                                                                                            |
| Two concurrent renders with the same Tailwind config   | Each call's `AsyncLocalStorage` stays isolated. Colors `17,34,51` and `68,85,102` do not mix. The global setup cache is shared and pure.  |
| parse5 offsets                                         | The `startOffset`/`endOffset` slice reproduces the original element, including the anchor attribute. The `href` slice contains the token. |

## Adopted transport

The section 11.3 gate failed for inter-row text: the HTML5 parent measured by parse5 differs from the parent written by React. P0 uses structural splice.

- Each dynamic site gets an opaque `vtx` token plus 20 hexadecimal characters. Identity is type, index, path, and detail. Locale and fixture are not part of the id.
- The block anchor remains `data-anchor`. The lexer only recognizes `vtx` plus 20 hex digits with non-hex neighbors. `data-vtx`, the word `vtx`, and `vtx-logo` are not markers. An unknown, truncated, split, escaped, hex-adjacent, or wrong-length complete token emits `TOK001`.
- parse5 reports start and end in the original string. The compiler inserts delimiters at those offsets and removes the anchor. Text, open, and alternative require an explicit closing tag (`endTag`). Without it, `TOK001`. A fragment or more than one child in the region emits `DSL002`.
- The document is not re-serialized after parse.
- React 19 copies the `src` of `<img>` into `<link rel="preload" as="image">` in `<head>`, outside `each` and `if`. The splice deletes that element. The `<img>` keeps `src`, `alt`, `width`, and `height`. Another copy of the same token emits `TOK001`. Restoring the token in `<head>` does not preserve Handlebars context.
- Pre-restoration HTML that already contains `{{` emits `HBS001`. The nested media-query `}}` pair is CSS, not a delimiter, and remains.
- Marker or catalog failure does not promote a file.

## What the end-to-end proof measured

Template `packages/react/golden-fixtures/emails/order-confirmed.email.tsx`, synthetic delivery (`en-US`) and pickup (no locale) fixtures, catalogs `pt-BR` and `en-US`.

- Compilation does not receive the fixture. Absence of `ORD-A`, names, streets, `20000`, and `200,00` in the artifact is what shows the build does not freeze the fixture. Comparing the hash of two compilations without passing the fixture ahead of time does not measure that.
- The two fixtures produce different previews. Preview evaluates the same string written to disk.
- After restoration, no complete opaque token remains. Ordinary text with `vtx` is not, by itself, a marker. The artifact does not contain `rel="preload"`. Item URLs stay in the loop `src`.
- The artifact contains `{{#each orders}}`, `{{#each items}}`, `{{#if shippingData.address}}`, `{{else}}`, `{{../orderId}}`, `{{formatCurrency sellingPrice}}`, and `{{replace shippingEstimate "bd" " business days"}}`, balanced.
- Each item of order `ORD-A` shows the parent `orderId`. The same holds for the single item of `ORD-B`.
- Present address shows the street. Absence shows the translated alternative.
- Dynamic text escapes `&`, quotes, and `<`. Unicode remains readable. In attributes, Handlebars 4.7 also escapes `=` as `&#x3D;`.
- `@media`, `sm_p-4`, and `<!--[if mso]>` remain in the artifact.
- The combined source has two documents. Each preview has one `doctype`, one `html`, one `head`, and one `body`, counted in the resolved string. A second `<html>` in that string emits `HTML001`. The count does not go through a parser.
- Missing locale and locale `fr-FR` fall back to `pt-BR`.
- A missing catalog key emits `I18N001` and does not create a file. A truncated token emits `TOK001` and also does not create a file.
- Two simultaneous compilations with catalogs `TITLE-AAA` and `TITLE-BBB` do not swap titles. Two others, with `orderId` and `orderUrl`, do not swap the expression. The color probe uses another `AsyncLocalStorage`, not the compiler session.
- Output uses LF. The artifact is written under a temporary directory with a space in the name only after success.

## Helper evidence state

| Capability        | State                                             | Limit                                                                                                                            |
| ----------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `each`            | documented                                        | Native Handlebars helper. Not executed in Message Center.                                                                        |
| `if`              | documented                                        | Handlebars truthiness.                                                                                                           |
| `../`             | documented                                        | Handlebars parent path. The real VTEX event envelope remains in P1.                                                              |
| `formatCurrency`  | documented for `20000` → `200,00`, without symbol | Other integers follow the same local cents simulator. That is not VTEX parity.                                                   |
| `replace`         | documented for one occurrence                     | Path plus two literals, as in the `8bd` example.                                                                                 |
| `eq` with literal | experimental                                      | The official example compares two paths. The proof uses the literal only to select `en-US` at the root of the combined document. |

The manifest marks `homologation: experimental`.

## Classification

- Proven by test and code: removal of dynamic-image preload, preservation of the original `src`, two item URLs without `imageUrl` at the root, false-condition image absent from the resolved document, explicit close, static neighbors outside the block, `DSL002` for fragment and multiple roots, lexer that ignores loose `vtx` and rejects a corrupted token, catalog isolation and distinct paths, textual count of a single `html`/`head`/`body` in the resolved string, lockfile pins, Node `24.21.0` in this Windows run.
- Partially proven: the fixture does not enter the artifact, by absence of sentinels and because `compileEmail` does not read the fixture. The hash of two identical compilations does not demonstrate that.
- Hypothesis the code rejects: rewriting the preload in `<head>` would be equivalent to `src` inside `each` or `if`.
- External pending: Message Center, email clients, Linux, macOS, and any Node other than `24.21.0`.

## Pending external gates

These items do not block the local proof and are not verified:

- Message Center accepting the combined HTML, `eq` with literal, `formatCurrency`, `replace`, escaping, and `../` context.
- Real email clients, including classic Outlook, for layout, media query, and MSO comments.
- Linux and macOS. This run covers Windows. The Node script does not depend on Bash or PowerShell; runs on the other two systems remain for CI.

## Limitations P1 inherits

- Juice, minification, and `pretty: true` remain off.
- Each DSL block region has a single root element, so an anchor can exist.
- `Trans` reads only a static catalog string. No placeholder, plural, or HTML in the message.
- Static URLs accept `https`, `mailto`, and `tel`. Dynamic URL scheme is not checked.
- The proof locale path is the synthetic fixture `orders.0.clientPreferencesData.locale`.
