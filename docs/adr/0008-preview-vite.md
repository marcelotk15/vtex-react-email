# ADR 0008 — Preview with Vite and packaged distribution

Consulted on 2026-10-02. Complements ADRs 0004, 0005, and 0006 and sections 6 and 16 of RFC-001.

## Decision

`vtex-email dev` starts Vite 7 (`7.3.1`) programmatically, with `configFile: false`, `appType: 'custom'`, `strictPort: true`, and default host `127.0.0.1`. The consumer does not create `vite.config.ts`, install plugins, or copy the UI. A neighboring `vite.config.ts` in the user project is not loaded.

The React interface is delivered as prebuilt assets in `@vtex-email/preview/dist/client`. The monorepo `vite build` uses `@vitejs/plugin-react@5.1.3` and `@tailwindcss/vite@4.1.18` only when building the package. In the consumer, workbench HMR is off. Changing an email does not rebuild the UI.

Domain transport remains SSE on `GET /api/events` with the full `PreviewState`. Vite's WebSocket does not carry email state. Handlebars HTML remains only in the iframe `srcdoc`.

The Vite plugin is internal to Preview. There is no public plugin for third-party Vite apps in this phase.

Vite caches live under `os.tmpdir()` with a project and pid hash, outside the watched directory and outside the installed package. The template loader still uses esbuild `0.28.2` and its own temporary caches.

Vite 8 and Tailwind above `4.1.18` stay out: the ADR 0001 pin and the `@tailwindcss/vite@4.1.18` peer cover the 7 line. Vite's `closeServer` hook is also outside the contract; dispose is `server.close()` called by `startPreview().close()`.

## Distribution

Packages emit `dist/` with esbuild on publish. The CLI exposes `@vtex-email/cli` (`defineConfig`) and `@vtex-email/cli/project` (orchestration). The bin is `dist/bin.js`. The `tooling/external-install/external-install.ts` proof packs tarballs, installs outside the workspace, and runs `validate`, `build`, and `dev`.

## What remains out of scope

Public Vite plugin, Turborepo, Vite 8, bumps of React/React Email/Tailwind, and any VTEX `verified` capability.
