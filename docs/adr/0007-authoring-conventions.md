# ADR 0007 — Authoring by conventions and settings

Consulted on 2026-10-02. Complements ADRs 0002, 0003, and 0006. Updated for `schemasDir`.

## Context

The API `export default defineEmail({ id, event, template, schema, fixtures, i18n })` forced repetition in every template. Schema and fixtures were already the orchestration's responsibility (CLI), not the compiler's.

## Decision

1. The email module **default-exports the React component**. Optional overrides live in `export const settings` typed with `EmailSettings` (`satisfies`) from `@vtex-email/core`.
2. The file key (`fileKey`) is the basename without the `.email.tsx` suffix. By convention it determines `id`, `event`, the fixtures folder, and the schema file — even if `settings.id` or `settings.event` are overridden.
3. The project declares in `defineConfig`:
   - `fixturesDir` (default `fixtures`)
   - `schemasDir` (default `schemas`); schema at `{schemasDir}/{fileKey}.ts` with Zod `export default`
   - `i18n.localePath` (project default; optional)
4. Precedence per field: `settings` → project config/defaults → file convention. `i18n` merge is shallow; arrays and `aliases` replace. An invalid value produces a diagnostic; there is no silent fallback.
5. Fixtures: non-recursive listing of `.json` and `.jsonc` in the resolved folder; each file is an envelope `{ meta, data }` (optional `$schema`); legacy `{id}.meta.json` sidecars and bare payloads are errors; `.json`/`.jsonc` collision with the same id → error. Missing folder → error; empty folder → zero fixtures.
6. `defineEmail` is removed. The internal normalized shape (`EmailDefinition`) remains in the CLI after resolution.
7. The compiler still receives only `{ id, event, template }`. It does not read fixtures, directories, or settings.

## JSONC parsing

The CLI uses `jsonc-parser` (ESM). Comments and trailing commas are accepted. Parse errors report file, line, and column; a partial value is refused. The original file on disk is not rewritten.

## Consequences

- Minimal authoring: component + project `localePath` + `{schemasDir}/{fileKey}.ts` + fixtures folder.
- Autocomplete via `satisfies EmailSettings` (no language plugin).
- Watching `.jsonc` revalidates fixtures without recompiling the template; a change in `{schemasDir}/{fileKey}.ts` revalidates schema, paths, and fixtures without calling `compileEmail`.
- Examples, test fixtures, and docs migrate to the new API; no compatibility layer.
