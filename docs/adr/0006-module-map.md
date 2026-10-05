# ADR 0006 — Internal toolchain module map

Consulted on 2026-10-02. Complements ADRs 0001 through 0005 and 0008. Does not create a new package. Preview continues to depend on the CLI (ADR 0004).

## Decision

Each folder has one responsibility. There is no barrel per folder. The only `index.ts` files are the package ones.

- `@vtex-email/core` holds contracts (`define-email` / `EmailSettings`, `diagnostics`, `profile`), `expression/`, `hbs/`, `markers/`, `schema/`, `scope/`, `compile/`, `i18n/`, `fixture/`, `runtime/`, and `output/`. Compilation does not read fixtures, evaluate, or write files. `runtime/` does not import `compile/` or `output/`. `node:fs` lives in `output/`.
- `@vtex-email/react` has `dsl/`, `compile/` (session and `compileEmail`), and `adapter/`. It does not use esbuild, CLI, or preview.
- `@vtex-email/vtex` separates `capabilities.ts` from `simulator.ts`. `index.ts` only composes `p0Profile`. The id remains `p0-message-center-experimental`.
- `@vtex-email/cli` separates `commands/` (process and output), `config/`, and `project/` (esbuild only in `project/module-loader.ts`). `project/` does not use `process` or stdout. Publication emits `dist/index.js` (`defineConfig`) and `dist/project.js` (orchestration). The CLI depends on `@vtex-email/vtex` and uses the installed `p0Profile` as the Message Center target; projects do not declare a profile file.
- `@vtex-email/preview` separates `shared/` (no Node and no DOM), `server/` (includes `vite-plugin.ts`), `session/`, `assets/`, and `ui/`. Only `server/project-services.ts` imports values from `@vtex-email/cli/project`. `session/` imports types only. The UI imports UI and `shared/`. The published runtime is `dist/index.js` with the UI in `dist/client`.

Package order is `vtex → core`, `react → core`, `cli → react` / `core` / `vtex`, `preview → cli`.

## Contract

- Core no longer exports `assertPinnedNode`. The Node pin lives in `tooling/node-pin.ts`, used by the Vitest config.
- React no longer exports `loadEmailEntry` and `LoadEmailResult`, and no longer depends on esbuild. Loading moves to `cli/project/module-loader.ts`.
- Core now exports `assembleDocument`, `findCapability`, `unverifiedCapabilityDiagnostic`, `readPathValue`, `Failure`, and the types `BuildManifest`, `CompiledArtifact`, and `CompileEmailResult`.
- The CLI publishes `defineConfig` at `@vtex-email/cli` and orchestration at `@vtex-email/cli/project`.
- `Diagnostic` may carry `capability: { name, evidence }` on `TARGET001`, so the report does not depend on message text.

`importBundled` remains public and delegates to the same loader. `PreviewServices` remains and includes `revalidateSchema`.

## Module cache

The CLI loader (`project/module-loader.ts`) writes the bundle to a per-process temporary directory and tries to delete that directory after import. On Windows the imported file may stay locked until the process exits; residual cleanup runs on `exit`. The imported module remains in Node's ESM cache until the process exits; that limits disk growth in `dev`, but process memory still grows with each imported URL.
