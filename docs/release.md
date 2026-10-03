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
- Internal workspace ranges are `workspace:*`. On `pnpm pack` / publish, pnpm rewrites them to the **concrete** dependency version present in the workspace at pack time.
- `updateInternalDependencies`: `patch` controls whether, for packages **already in the same release**, Changesets rewrites classic semver dependency ranges when the depended-upon package bumps. It does **not** mean “every dependent always gets a patch”. With `workspace:*`, Changesets leaves the string as `workspace:*` (no range rewrite).
- Dependent inclusion uses Changesets’ default `updateInternalDependents: "out-of-range"`. For `workspace:*`, the effective range for that check is the dependency’s **previous exact version**, so a dependency bump typically adds dependents with a patch. This repo does **not** enable `updateInternalDependents: "always"` and does not add custom cascade publishing.
- 0.x: treat breaking public API as **`minor`** (policy is fixed; do not use `major` for 0.x breaks in this project).
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
4. Open a PR. CI checks changeset coverage against the PR base (`main`). Presence of an unrelated changeset is not enough if a touched publishable package is missing.

Automation can require declaration and consistency. It cannot prove that a `patch` should have been a `minor`.

## Release PR

On push to `main`, `.github/workflows/release.yml` waits for CI checks on **that same SHA**, then runs `changesets/action`:

1. If open changesets exist → create/update PR titled `chore(release): version packages` on branch `changeset-release/main`.
2. That PR updates versions, changelogs, internal deps, and the lockfile.
3. Review the package list in the PR diff before merge.
4. The Version PR must pass the same CI and external-install proof.
5. **Supported merge strategy: squash merge.** The squash commit message must remain `chore(release): version packages`. Cohort discovery compares `HEAD^` (single parent) to `HEAD`. Merge commits and rebase merges are not supported for publish discovery.

`GITHUB_TOKEN` commits from Actions do not re-trigger `pull_request` workflows. Configure secret `RELEASE_GITHUB_TOKEN` (PAT or GitHub App with `contents` + `pull_requests`) so the Version PR receives required checks. Without it, checks may never run on bot-created PRs. CI listens to `opened`, `synchronize`, `reopened`, and `edited` so title fixes re-run commitlint.

Changeset coverage skips the Version PR only when the head branch is `changeset-release/*` **and** the diff is structural (package.json / CHANGELOG / `.changeset` / lockfile only). Title or author alone is not enough.

## Selective publish

After the Version PR squash-merges and validations succeed on that commit:

1. CI job `pack-release-artifacts` builds once and uploads packed tarballs + SHA-256 manifest for that SHA.
2. `release.yml` waits for checks `ci-result` and `pack-release-artifacts` on the same SHA, then downloads those artifacts.
3. Publish set = non-private packages whose version **changed in the release commit** (message `chore(release): version packages`) and whose version is **absent** from the registry (or treated as already present after a lost success / 409).
4. Publish the **validated tarballs** (`npm publish <tarball>`). No rebuild in the publish path.
5. Publish in dependency order. If a package fails, skip its dependents; report published / failed / skipped; fail the job.
6. Already-published versions are not republished (resume). Do not unpublish or overwrite.
7. Registry auth/network errors are not treated as “package missing”.
8. Then create (or verify) git tags and GitHub Releases as `@scope/name@version` for the full cohort, including packages already on the registry.
9. Dist-tag `latest` is not moved backwards when resuming an older release.

A package at `0.0.0` that never appeared in a release bump is **not** published just because npm returns 404. A manual version edit on `main` without the release commit message is **not** an approved release.

Before publishing, an internal-dependency gate ensures each cohort package’s runtime workspace deps exist on the registry (or in the same cohort) at compatible versions. Preview-only first publish is rejected if CLI/core are still unpublished.

Dry-run locally (no publish):

```bash
pnpm release:plan
# or
SKIP_NPM_PUBLISH=1 RELEASE_BUMPED_NAMES='@vtex-email/preview' pnpm release -- --dry-run
```

`pnpm release:plan` without an approved release commit reports an empty cohort (unless `RELEASE_BUMPED_NAMES` is set for local forcing).

## Bootstrap (first publish)

npm Trusted Publishing requires the package to **already exist** on the registry before an OIDC trusted publisher can be configured.

Supported procedure:

1. Own the npm scope `@vtex-email` (or rename packages before first publish).
2. **First authenticated publish** (one-time): publish each package name with a maintainer npm login or a short-lived granular token (local `npm publish` / `pnpm publish`, or a one-shot protected workflow that injects `NPM_TOKEN` only for bootstrap). This creates the package records. Prefer a placeholder such as `0.0.0` under a non-`latest` tag (for example `bootstrap`) if you need the name reserved before a real Version PR.
3. On npmjs.com → package Settings → Trusted Publisher → GitHub Actions:
   - Repository owner / name
   - **Workflow filename:** `release.yml` (filename only — not `.github/workflows/release.yml`)
   - Allow `npm publish` for this trusted publisher as required by the current npm UI
4. Confirm the workflow job has `permissions.id-token: write` (already set). npm CLI ≥ 11.5.1 is required (Node `24.21.0` satisfies this).
5. Set `RELEASE_GITHUB_TOKEN` for Version PR CI.
6. Add intentional changesets bumping selected packages (for example to `0.1.0`), open/merge the Version PR after CI is green.
7. Subsequent releases publish via OIDC from `release.yml` **without** `NPM_TOKEN`.
8. First real cohort must satisfy the internal-dependency gate (do not publish Preview alone if its packed dependency on CLI/core is not available).

Until the first versions exist on npm, the external-install proof continues to pack all workspace tarballs together (it rewrites `workspace:*` to `0.0.0` for local file installs — that is **not** the publish conversion).

## Retries and partial releases

Publication is not atomic across registry + git tag + GitHub Release.

Re-run the release workflow on the **same commit**:

1. Registry: skip versions that already exist (including 409 / “already published” after a lost success response).
2. Git tags: create if missing; if present, require they point at the release SHA; fail on conflict.
3. GitHub Releases: create if missing.
4. Do not move `latest` to an older version while finishing metadata for a resumed older release.

Do not cancel an in-flight publish with a new overlapping run (`cancel-in-progress: false`).

## External configuration checklist

- [ ] npm scope ownership for `@vtex-email`
- [ ] First authenticated publish per package (bootstrap), then Trusted Publishing with workflow filename `release.yml`
- [ ] Secret `RELEASE_GITHUB_TOKEN` (PAT or GitHub App)
- [ ] Branch protection required checks: matrix `check` jobs, `changeset`, `commitlint`, `ci-result`, and on `main` also `pack-release-artifacts`
- [ ] First intentional Version PR + OIDC publish

Local proofs and unit tests do **not** homologate GitHub Actions, OIDC, or real npm publishing.

## Local hooks

See [CONTRIBUTING.md](../CONTRIBUTING.md). CI sets `HUSKY=0` so hooks do not install or run in Actions; checks run explicitly in jobs.
