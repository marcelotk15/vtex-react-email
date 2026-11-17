# @vtex-email/cli

## 0.2.3

### Patch Changes

- Updated dependencies [495a201]
  - @vtex-email/core@0.4.1
  - @vtex-email/react@0.4.1
  - @vtex-email/vtex@0.4.1

## 0.2.2

### Patch Changes

- 54927f6: Message Center homologation and preview session fixes:

  - `each`, `if`, `unless`, `../`, `@index`, `formatCurrency`, `formatDate`, `eq`, and `ifCond` are now `verified` capabilities (records from Message Center runs), so builds no longer warn about them as unverified.
  - Preview: a partial rebuild that fails for one email keeps the emails that compiled, and fixture edits are reloaded even when a schema revalidation fails.
  - CLI: aligned with the new capability evidence.

- Updated dependencies [54927f6]
- Updated dependencies [54927f6]
  - @vtex-email/core@0.4.0
  - @vtex-email/vtex@0.4.0
  - @vtex-email/react@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [f3cd8e7]
- Updated dependencies [f3cd8e7]
  - @vtex-email/core@0.3.0
  - @vtex-email/react@0.3.0
  - @vtex-email/vtex@0.3.0

## 0.2.0

### Minor Changes

- 479cb5f: Use the installed `@vtex-email/vtex` `p0Profile` as the Message Center target. Remove `target.profile` from project config.
- 479cb5f: Merge fixture meta and payload into a single `{ meta, data }` file and publish `fixture.schema.json` from core.

### Patch Changes

- Updated dependencies [479cb5f]
- Updated dependencies [479cb5f]
  - @vtex-email/core@0.2.0
  - @vtex-email/react@0.2.0
  - @vtex-email/vtex@0.2.0

## 0.1.0

### Minor Changes

- acc71e2: First public release of the VTEX Email toolchain.

### Patch Changes

- Updated dependencies [acc71e2]
  - @vtex-email/core@0.1.0
  - @vtex-email/react@0.1.0
