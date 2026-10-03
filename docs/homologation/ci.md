# CI matrix and release closing evidence

The file [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) describes the portability matrix. Creating or updating the file is not execution evidence on GitHub-hosted runners until the workflow has run there.

## What the matrix contains

- Systems: `ubuntu-latest`, `windows-latest`, `macos-latest`.
- Node: only `24.21.0`, the ADR 0001 pin. Other versions are intentionally out.
- pnpm `12.8.1`, install with `--frozen-lockfile`, `HUSKY=0`.
- On each system (`check` job): `format:check`, `lint`, `build`, `typecheck`, `test` (includes `tooling/external-install`), and the `@vtex-email/example` build. `build` must precede `typecheck` because workspace package `exports.types` resolve to generated `dist/*.d.ts`.
- On pull requests (Ubuntu): `changeset` coverage + `changeset status`, and `commitlint` for new commits and the PR title.
- On push to `main`: `pack-release-artifacts` uploads packed tarballs + SHA-256 manifest for the commit.
- Aggregated gate: `ci-result` so required checks have a defined outcome when PR-only jobs are skipped on push.

Release automation lives in [`.github/workflows/release.yml`](../../.github/workflows/release.yml). See [docs/release.md](../release.md).

## Local closing round (release)

Executed in the developer workspace (not GitHub Actions / not npmjs):

| Proof                                                                          | Result                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changesets 3.0.3 semantics (`tooling/release/changesets-semantics.test.ts`)    | `updateInternalDependencies` does not cascade dependents for in-range classic semver; out-of-range and `workspace:*` behave as documented                                                                   |
| Preview-only cohort (`tooling/release/preview-cohort.test.ts`)                 | Changeset → `changeset version` → squash message → `detectBumpedNames(HEAD^)` selects only `@vtex-email/preview`; orphan untouched; manual bump ≠ approved release; resume SHA stable after `main` advances |
| Internal dependency gate (`tooling/release/internal-deps-gate.test.ts`)        | Preview-only blocked when CLI missing; allowed when CLI published or in cohort                                                                                                                              |
| Pack conversion (`tooling/release/pack-artifacts.test.ts`)                     | `pnpm pack` rewrites `workspace:*` → concrete version                                                                                                                                                       |
| Resume metadata (`tooling/release/resume-metadata.test.ts`)                    | 409 vs auth failure; tag conflict; metadata completion without republish; no `latest` regression                                                                                                            |
| Coverage skip (`tooling/release/changeset-coverage.test.ts`)                   | Title alone insufficient; structural `changeset-release/*` + version diff required                                                                                                                          |
| Partial install simulation (`tooling/release/partial-release-install.test.ts`) | New Preview tarball + older CLI/core file tarballs install together                                                                                                                                         |
| Publish gate evaluator (`tooling/release/wait-for-ci.test.ts`)                 | Failed/missing checks block; success requires `ci-result` + `pack-release-artifacts`                                                                                                                        |
| Local `pnpm release:pack`                                                      | Packs five publishable tarballs; Preview’s packed dep is `@vtex-email/cli@0.0.0` (workspace rewrite)                                                                                                        |

**Local CI gate executed:** `format:check`, `lint`, `build`, `typecheck`, `test` (185), `@vtex-email/example` build, `release:pack`.

**Limitation:** while packages are unpublished on npmjs, partial-release proof uses file tarballs, not registry resolution of “new Preview + previously published CLI”.

**Not homologated by this local round:** GitHub Actions runners, OIDC trusted publishing, real npm publish, real git tag push, or real GitHub Releases.

## What a future log can promote

A green job promotes only that system, on that Node, on the log date. Other Node majors and patches remain pending, because the matrix does not run them.

The matrix does not run Message Center or email clients.
