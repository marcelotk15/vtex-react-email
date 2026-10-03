# ADR 0001 — Pinned versions for the P0 proof

Consulted on 2026-10-01. Exact versions also live in `pnpm-lock.yaml`.

## Decision

The local proof pins the set below. Bumping any of these packages requires a new measurement of table, attribute, button, media query, and Handlebars delimiter preservation.

| Package                   | Version                                                                                                                       | Reason                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                   | Executed version `24.21.0` (`process.version` `v24.21.0`, win32 x64, 2026-10-01). `engines` and `.nvmrc` repeat that version. | Supported interval for this proof: only Node `24.21.0` on Windows. React Email declares `node >= 20`. That is not support evidence. Linux, macOS, and other majors remain unexecuted.                         |
| pnpm                      | `12.8.1` in the `packageManager` field                                                                                        | Requires Node `>= 18`. `allowBuilds.esbuild` enables the esbuild postinstall, which pnpm 12 ignores until approval.                                                                                           |
| TypeScript                | `5.9.3`                                                                                                                       | React Email packages are developed with `5.9.3`. The `7.0.2` published as `latest` stays out of P0.                                                                                                           |
| React and React DOM       | `19.3.0`                                                                                                                      | React Email peer: `^18 \|\| ^19`. The pair matches. React 19's server copies `src` from `<img>` to `<link rel="preload" as="image">` in `<head>`. The proof removes that link and does not rewrite the image. |
| `@react-email/components` | `1.0.12`                                                                                                                      | Brings `@react-email/render@2.0.6`, `@react-email/tailwind@2.0.7`, and `@react-email/button@0.2.1`. `render` returns `Promise<string>`. The proof calls `render(node, { pretty: false })`.                    |
| `tailwindcss`             | `4.1.18`                                                                                                                      | `@react-email/tailwind@2.0.7` declares `tailwindcss: ^4.1.18`. Without override, the range resolves to `4.3.3`. Component docs still cite `4.1.12`. The pnpm override prevents that bump.                     |
| Handlebars                | `4.7.9`                                                                                                                       | Each evaluation uses `Handlebars.create()`, with `noEscape: false` and `knownHelpersOnly: true`. Prototype access remains off by default.                                                                     |
| Zod                       | `4.6.5`                                                                                                                       | Fixture schema with `z.looseObject()`. `safeParse` reads a clone; preview receives the original JSON. No coerce, default, or transform.                                                                       |
| Vitest                    | `5.0.3`                                                                                                                       | Sole runner. JSX via oxc with automatic runtime.                                                                                                                                                              |
| esbuild                   | `0.28.2`                                                                                                                      | Loads the template TSX. `react`, `react-dom`, and `@react-email/*` stay external so `Button` identity is not duplicated.                                                                                      |
| parse5                    | `7.3.0`                                                                                                                       | HTML5 parser for splice and the probe oracle. Enters the compiler because the inter-row table text gate failed.                                                                                               |

## Sources

- [nodejs/Release](https://github.com/nodejs/release) and [dist/latest-v24.x](https://nodejs.org/dist/latest-v24.x/) for LTS.
- npm registry for each package, read on the consult date.
- Types and preset published in `@react-email/tailwind@2.0.7` (`dist/index.d.mts` and `dist/index.mjs`): `pixelBasedPreset` converts `fontSize` and `spacing` to px.
- [Handlebars runtime options](https://handlebarsjs.com/api-reference/runtime-options.html) and [compilation](https://handlebarsjs.com/api-reference/compilation.html).

## Outside this decision

TypeScript 7, Tailwind `4.3.3`, `pretty: true`, Juice, minification, Playwright, and the VTEX client are not in P0.
