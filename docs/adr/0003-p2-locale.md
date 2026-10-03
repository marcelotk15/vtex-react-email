# ADR 0003 — P2A locale

Consulted on 2026-10-02. Complements ADR 0002 and sections 8, 13, 15, and 23 of RFC-001. The authoring shape (`defineEmail`) was replaced by ADR 0007; the locale/compile contract remains.

## Decision

The email definition describes one email for all languages. The `locale` field leaves the definition and enters `compileEmail` as the language for that compilation. The same definition is compiled once per locale. `compileEmail` still does not receive a fixture, schema, or payload validation. Orchestration in `@vtex-email/cli` associates schema, fixtures, and catalogs, merges the variants, and writes the result.

`i18n.localePath`, `output`, and `aliases` live on the definition. Locales and the default language come from the email when declared, otherwise from the project. An alias becomes an explicit branch in the combined artifact. The final `else` is `defaultLocale`.

The selector uses the profile's `eq` block. That capability remains `experimental` and outside the DSL. `merged` output without it is `HBS002`, with no silent fallthrough to separate files. `per-locale` does not emit `eq`. The project manifest remains `homologation: experimental`.

`validateHandlebarsSyntax` uses `precompile` and discards the JavaScript. The written file remains HTML with Handlebars.

Fixture validation rejects a schema with coerce, default, prefault, catch, or pipe, and also `def.coerce`. Evaluation receives the original object.

The path analyzer reads Zod 4's public `.def`. Types outside the subset produce `PATH_UNANALYZABLE`.

The `basic-store` example leaves `unverifiedCapability` as `warning`. The config default, when the field is omitted, remains `error`, as in the RFC. The current profile has no `verified` capability, so a production build with the default refuses the experimental manifest only when that option is `error`. `unverifiedCapability` evaluates the capability emitted in the artifact. An experimental capability present in the profile and absent from the artifact does not block the build by itself.

## What remains out of scope

Visual preview, Message Center, email clients, and any Node other than the pin in ADR 0001. Linux and macOS remain unexecuted.
