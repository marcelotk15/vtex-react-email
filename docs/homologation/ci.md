# CI prepared and not yet executed

The file [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) describes the matrix that may, in the future, verify declared portability. Creating the file is not execution evidence. This workspace is not a git repository and has no remote, so the workflow has not run yet.

## What the matrix contains

- Systems: `ubuntu-latest`, `windows-latest`, `macos-latest`.
- Node: only `24.21.0`, the ADR 0001 pin. Other versions are intentionally out and remain pending.
- pnpm `12.8.1`, install with `--frozen-lockfile`.
- On each system: `pnpm typecheck`, `pnpm test`, and the `@vtex-email/example` build.

## What a future log can promote

A green job promotes only that system, on that Node, on the log date. Windows on Node `24.21.0` already has a local run on 2026-10-02 (`win32` `x64`); a future job repeats that line, not the other systems. Linux and macOS remain pending until the matching log. Other Node majors and patches remain pending, because the matrix does not run them.

The matrix does not run Message Center or email clients.
