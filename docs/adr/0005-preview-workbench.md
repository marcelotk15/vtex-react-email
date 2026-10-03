# ADR 0005 — Preview workbench

Consulted on 2026-10-02. Complements ADR 0004. Updated by ADR 0008.

## Decision

The `vtex-email dev` interface is a React app in the browser, served by the same preview process. The contract is `PreviewState` with `formatVersion` 1. The server sends the full state via `GET /api/events` and receives selection via `POST /api/selection`. The snapshot adds the project name, `localePath`, the fixture file and metadata, and `data` as a clone of the original JSON. Forcing locale still alters only the evaluated copy.

The UI is prebuilt in the monorepo with Vite 7 and published under `dist/client` (ADR 0008). Interface CSS uses Tailwind `4.1.18` with `source(none)` and `@source` restricted to `src/ui`. That separates interface Tailwind from email Tailwind. Consumer `dev` serves those assets and does not rebuild the UI bundle. `GET /` delivers the shell, without CSP, because the iframe `srcdoc` inherits the page policy. `GET /assets/*` delivers JavaScript, CSS, and fonts. `dev` does not write the email project's `dist`.

The UI build rejects `node:`, built-ins, `@vtex-email/cli`, `@vtex-email/core`, `@vtex-email/react`, `@react-email/*`, and `react-dom/server`. Contract types may be imported: the file has no runtime import.

The interface uses `@base-ui/react` `1.8.0`, `react-resizable-panels` `4.14.1`, and Public Sans and JetBrains Mono packaged by `@fontsource`. There is no CDN font. Interface React and compiler React are distinct instances: the first enters the browser bundle; the second stays external in the Node runtime.

Selection comes from the server. A click only highlights the fixture until the snapshot confirms. Panel sizes, collapse, tab, viewport, and expanded emails live in `localStorage` under key `vtex-email.preview.ui.v2`. The interface theme preference (`white` | `dark` | `system`) lives in `vtex-email.preview.theme.v1`, separate from the resolved theme applied on `document.documentElement[data-theme]`. The default is `system`. The shell injects a minimal inline script before CSS to apply the theme before first paint; the page still has no CSP. Theme belongs only to the workbench: it does not alter resolved HTML, Handlebars, fixtures, `dist`, or the email `srcdoc`. The iframe declares `color-scheme: only light` in the interface CSS. Fixture, payload, HTML, and source are not persisted. Image blocking starts off on every load. Stale generations are ignored. A superseded `POST` is aborted. `srcdoc` changes only when the displayed document changes.

The network client listens for `offline` and `online`. `EventSource` may stay open without emitting an error when the context goes offline; the visible state follows the browser.

## Image measurement

Blocking remains as in ADR 0004: the `img-src 'none'` meta enters only the `srcdoc` copy. On 2026-10-02, in Edge driven by `playwright-core` `1.63.0`, React Email HTML with `<link rel="preload" as="image">` and `<img>` to `https://cdn.example/...` still issued requests for that URL with the meta already in `srcdoc`. The workbench does not rewrite those addresses. The proof observes the meta, the original attributes, and the absence of the meta in project files.

## What remains out of scope

Email clients, Message Center, Linux, macOS, and any Node other than the pin in ADR 0001. `playwright-core` `1.63.0` is a preview development dependency and does not change the compiler pins.
