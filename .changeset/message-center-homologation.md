---
'@vtex-email/vtex': minor
'@vtex-email/preview': patch
'@vtex-email/cli': patch
---

Message Center homologation and preview session fixes:

- `each`, `if`, `unless`, `../`, `@index`, `formatCurrency`, `formatDate`, `eq`, and `ifCond` are now `verified` capabilities (records from Message Center runs), so builds no longer warn about them as unverified.
- Preview: a partial rebuild that fails for one email keeps the emails that compiled, and fixture edits are reloaded even when a schema revalidation fails.
- CLI: aligned with the new capability evidence.
