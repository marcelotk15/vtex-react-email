# Contributing

## Setup

- Node `24.21.0` (see `.nvmrc`) and pnpm `12.8.1`
- `pnpm install` — installs dependencies and, when a `.git` directory is present, Husky hooks via `prepare`
- `pnpm build` — required after a clean checkout before `pnpm typecheck` (and useful before local CLI/example use). Package `exports.types` point at `dist/*.d.ts`, which are not committed (`dist/` is gitignored)
- CI and production-style installs set `HUSKY=0` so hooks are not installed or executed there

### Git hooks

| Hook         | Behavior                                                         |
| ------------ | ---------------------------------------------------------------- |
| `pre-commit` | `lint-staged` runs `oxfmt` / `oxlint --fix` on staged files only |
| `commit-msg` | `pnpm exec commitlint --edit "$1"`                               |

There is no `pre-push` hook. Full checks run in GitHub Actions.

If `core.hooksPath` already points outside this repo’s `.husky`, `prepare` will not override it. Unset the local config to use the project hooks:

```bash
git config --unset core.hooksPath
pnpm prepare
```

### Fixing hook failures

- **lint-staged / oxlint / oxfmt:** fix the reported files and stage again. Partially staged files are handled by lint-staged; unstaged work is left alone.
- **commitlint:** rewrite the message to Conventional Commits (see below). Use `git commit --amend` only on local commits that were not pushed.

## Conventional Commits

Format: `tipo(escopo opcional): descrição`

Accepted types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Examples:

```text
feat(preview): add system theme support
fix(core): preserve parent context in nested loops
refactor(cli): extract project services
ci: configure selective package publishing
chore(release): version packages
```

- Scope is optional. Suggested scopes mirror packages (`core`, `cli`, `preview`, `react`, `vtex`) but are not a rigid allowlist.
- Descriptions may be Portuguese or English.
- Breaking changes: `feat(cli)!: …` or a `BREAKING CHANGE:` footer.
- One commit may touch many packages; the scope need not list all of them.
- Squash merge: the **PR title** must also be a conventional commit (CI re-checks on title edits).

Conventional Commits organize history. They do **not** bump versions by themselves.

## Changesets

Publishable packages: `@vtex-email/core`, `@vtex-email/vtex`, `@vtex-email/react`, `@vtex-email/cli`, `@vtex-email/preview`.

```bash
pnpm changeset          # select packages + bump + summary
pnpm changeset --empty  # auditable no-release (docs/tests/examples)
```

Create a changeset when a publishable package’s distributed behavior, public API, types, embedded bundle code, or Preview assets change. Use an empty changeset when you intentionally ship no release.

Breaking public API while versions are `0.x` → changeset bump type **`minor`**.

Details, dependency graph, release PR, bootstrap, and retries: [docs/release.md](docs/release.md).

## Local vs CI

| Check                                                  | Local hooks          | CI                                            |
| ------------------------------------------------------ | -------------------- | --------------------------------------------- |
| Format / lint on staged files                          | pre-commit           | full tree `format:check` + `lint`             |
| Commit message                                         | commit-msg           | all new PR commits + PR title                 |
| Build then typecheck / tests / example / external-install | `pnpm build` then `pnpm typecheck` / `pnpm test` | required on every PR (`build` before `typecheck`) |
| Changeset coverage                                     | optional             | required on PRs                               |
| Publish                                                | never from hooks     | only `release.yml` on `main` after Version PR |

Consumer installs of published tarballs do not run monorepo `prepare` hooks (`files: ["dist"]`; no husky in package runtime deps).
