# Release policy

Independent versions per package via [Changesets](https://github.com/changesets/changesets). Conventional Commits organize history; Changesets decide which packages bump and by how much. There is no semantic-release.

## Package inventory

| Package               | Role                                                        | Distributed?   |
| --------------------- | ----------------------------------------------------------- | -------------- |
| `@vtex-email/core`    | Contracts, compile pipeline, diagnostics                    | Yes (`dist/`)  |
| `@vtex-email/vtex`    | Target profile and Message Center helpers                   | Yes            |
| `@vtex-email/react`   | Authoring DSL and React Email adapter                       | Yes            |
| `@vtex-email/cli`     | `vtex-email` bin, `defineConfig`, `@vtex-email/cli/project` | Yes            |
| `@vtex-email/preview` | Dev server + prebuilt UI (`dist/client`)                    | Yes            |
| `@vtex-email/example` | `examples/basic-store`                                      | No (`private`) |
| Root / `tooling/`     | Monorepo tooling                                            | No             |

Runtime dependency graph (publish order leaves-first):

```text
core → vtex, react → cli → preview
```

Workspace packages stay **external** in esbuild (`scripts/build-packages.mjs`). They are not inlined into each other. Non-listed npm deps (for example `jsonc-parser` in the CLI) and the Preview UI Vite bundle **are** embedded. A fix in embedded code requires a changeset on the package that ships the bundle, not only on the upstream npm dependency.

Shared contracts:

- CLI ↔ Preview: `@vtex-email/cli/project` and Preview HTTP/UI contract (`PreviewState`, selection API). Changing either side usually needs changesets on both packages when both change.
- Preview ships `dist/index.js` plus `dist/client` assets. UI-only changes → Preview only.

## Versioning

- Independent versions (no `fixed` group).
- `updateInternalDependencies`: `patch` — when a workspace dependency bumps, dependents get a patch and their dependency range updates.
- 0.x: treat breaking public API as `minor` (or `major` if you prefer stricter SemVer); document the choice in the changeset summary.
- Prereleases use Changesets pre mode when needed; dist-tag follows the prerelease id (`canary`, `alpha`, …) or `latest`.

### When to bump which package

| Change                                    | Changeset targets                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Public API or types in `core`             | `core` (+ consumers if they adapt)                                         |
| Only `vtex` / `react` / `cli` / `preview` | That package                                                               |
| Embedded CLI dep or Preview UI assets     | The packaging package (`cli` or `preview`)                                 |
| Docs, tests, `examples/basic-store` only  | `pnpm changeset --empty`                                                   |
| New package not yet released              | Do not publish until an intentional changeset bumps it in a release commit |

CI may test the whole monorepo. Publication follows the release plan only.

## Contribution flow

1. Implement the change.
2. Run `pnpm changeset` and select affected **publishable** packages, bump type, and a consumer-oriented summary.
3. For no-release work, run `pnpm changeset --empty` so the decision is auditable.
4. Open a PR. CI checks changeset coverage against the PR base (`master`). Presence of an unrelated changeset is not enough if a touched publishable package is missing.

Automation can require declaration and consistency. It cannot prove that a `patch` should have been a `major`.

## Release PR

On push to `master`, `.github/workflows/release.yml` runs `changesets/action`:

1. If open changesets exist → create/update PR titled `chore(release): version packages`.
2. That PR updates versions, changelogs, internal deps, and the lockfile.
3. Review the package list in the PR diff before merge.
4. The Version PR must pass the same CI and external-install proof.

`GITHUB_TOKEN` commits do not re-trigger workflows. Configure secret `RELEASE_GITHUB_TOKEN` (PAT or GitHub App with `contents` + `pull_requests`) so the Version PR receives required checks. Without it, checks may never run on bot-created PRs.

## Selective publish

After the Version PR merges and validations succeed on that commit:

1. Build packages once on that commit.
2. Publish set = non-private packages whose version **changed in the release commit** and whose version is **absent** from the registry.
3. Publish in dependency order. If a package fails, skip its dependents; report published / failed / pending; fail the job.
4. Already-published versions are skipped (resume). Do not unpublish or overwrite.
5. Registry auth/network errors are not treated as “package missing”.
6. Create git tags and GitHub Releases as `@scope/name@version`.

A package at `0.0.0` that never appeared in a release bump is **not** published just because npm returns 404.

Dry-run locally (no publish):

```bash
pnpm release:plan
# or
SKIP_NPM_PUBLISH=1 pnpm release -- --dry-run
```

## Bootstrap (first publish)

1. Own the npm scope `@vtex-email` (or rename packages before first publish).
2. Configure npm Trusted Publishing (OIDC) for workflow `.github/workflows/release.yml` on each package; grant `id-token: write` (already in the workflow).
3. Set `RELEASE_GITHUB_TOKEN` for Version PR CI.
4. Add intentional changesets bumping selected packages from `0.0.0` (for example to `0.1.0`).
5. Merge the Version PR after CI is green.
6. Let the release workflow publish only the bumped set.

Until the first versions exist on npm, the external-install proof continues to pack all workspace tarballs together (unchanged).

## Retries and partial releases

Publication is not atomic. Re-run the release workflow on the same commit: already-published versions are skipped; pending ones continue. Do not cancel an in-flight publish with a new overlapping run (`cancel-in-progress: false`).

## External configuration checklist

- [ ] npm scope ownership for `@vtex-email`
- [ ] Trusted Publishing / OIDC for `release.yml` per package
- [ ] Secret `RELEASE_GITHUB_TOKEN` (PAT or GitHub App)
- [ ] Branch protection required checks: matrix `check` jobs, `changeset`, `commitlint`, `ci-result`
- [ ] First intentional Version PR + publish

## Local hooks

See [CONTRIBUTING.md](../CONTRIBUTING.md). CI sets `HUSKY=0` so hooks do not install or run in Actions; checks run explicitly in jobs.
