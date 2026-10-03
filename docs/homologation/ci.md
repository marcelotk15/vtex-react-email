# CI matrix

The file [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) describes the portability matrix. Creating or updating the file is not execution evidence on GitHub-hosted runners until the workflow has run there.

## What the matrix contains

- Systems: `ubuntu-latest`, `windows-latest`, `macos-latest`.
- Node: only `24.21.0`, the ADR 0001 pin. Other versions are intentionally out.
- pnpm `12.8.1`, install with `--frozen-lockfile`, `HUSKY=0`.
- On each system (`check` job): `format:check`, `lint`, `typecheck`, `test` (includes `tooling/external-install`), `build`, and the `@vtex-email/example` build.
- On pull requests (Ubuntu): `changeset` coverage + `changeset status`, and `commitlint` for new commits and the PR title.
- Aggregated gate: `ci-result` so required checks have a defined outcome when PR-only jobs are skipped on push.

Release automation lives in [`.github/workflows/release.yml`](../../.github/workflows/release.yml). See [docs/release.md](../release.md).

## What a future log can promote

A green job promotes only that system, on that Node, on the log date. Other Node majors and patches remain pending, because the matrix does not run them.

The matrix does not run Message Center or email clients.
