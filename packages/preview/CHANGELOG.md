# @vtex-email/preview

## 0.1.5

### Patch Changes

- @vtex-email/cli@0.2.4

## 0.1.4

### Patch Changes

- 495a201: Preview accepts templates built with `Email doctype={null}`: the single-document check (HTML001) allows a missing doctype and still rejects duplicated documents. The preview's "Could not update" panel now shows the first error diagnostic instead of the first diagnostic of any severity.
- @vtex-email/cli@0.2.3

## 0.1.3

### Patch Changes

- 54927f6: Message Center homologation and preview session fixes:

  - `each`, `if`, `unless`, `../`, `@index`, `formatCurrency`, `formatDate`, `eq`, and `ifCond` are now `verified` capabilities (records from Message Center runs), so builds no longer warn about them as unverified.
  - Preview: a partial rebuild that fails for one email keeps the emails that compiled, and fixture edits are reloaded even when a schema revalidation fails.
  - CLI: aligned with the new capability evidence.

- Updated dependencies [54927f6]
  - @vtex-email/cli@0.2.2

## 0.1.2

### Patch Changes

- @vtex-email/cli@0.2.1

## 0.1.1

### Patch Changes

- 479cb5f: Use the installed `@vtex-email/vtex` `p0Profile` as the Message Center target. Remove `target.profile` from project config.
- Updated dependencies [479cb5f]
- Updated dependencies [479cb5f]
  - @vtex-email/cli@0.2.0

## 0.1.0

### Minor Changes

- acc71e2: First public release of the VTEX Email toolchain.

### Patch Changes

- Updated dependencies [acc71e2]
  - @vtex-email/cli@0.1.0
