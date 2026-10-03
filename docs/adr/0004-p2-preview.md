# ADR 0004 — P2C preview

Consulted on 2026-10-02. Complements ADR 0003 and sections 6, 13, and 16 of RFC-001. Updated by ADR 0008.

## Decision

`@vtex-email/preview` depends on `@vtex-email/cli` (via `@vtex-email/cli/project`) and is not a CLI dependency. The `vtex-email dev` command resolves the package from the consumer project and calls `startDev` in the same process. The Preview Node runtime is the published `dist/index.js`; there is no longer an `entry.mjs` packaging step on import.

The development server is Vite 7, started programmatically (ADR 0008). It calls `buildProject({ write: false })`, `refreshEmailFixtures`, `revalidateEmail`, and `previewBuiltEmail` in the same process.

Watch does not write `dist`. A fixture-only change revalidates and re-evaluates the already compiled artifact. Forcing locale alters the fixture copy, not the file. The iframe uses an empty `sandbox`. The default address remains `127.0.0.1:3000`. On shutdown, the process closes the Vite server, SSE connections, and the session.

The “Block remote images” control starts off. When on, only the copy placed in `srcdoc` receives `<meta http-equiv="Content-Security-Policy" content="img-src 'none'">`. The meta covers `<img>`, `srcset`, and CSS `url()`. Original attributes remain in that copy for inspection. Resolved HTML, Handlebars source, fixtures, and `dist` do not receive the meta. Turning the control off returns to the resolved HTML, and the view requests images again. The empty `sandbox` does not block those requests; that is why the meta exists, and only on the displayed copy. On 2026-10-02, Node `24.21.0`, `win32` `x64`, headless Edge 154 saw the meta immediately after `<head>` only in `srcdoc`. A local server with `Cache-Control: no-store` and URLs from that run received zero `img`, `srcset`, and `url()` requests in the iframe that started blocked; turning it off requested all three; turning it on again added no request; turning it off again requested again. That does not observe the email client.

The workbench that shows this document is ADR 0005. Blocking remains only on the `srcdoc` copy and remains off on every load.

The consumer installs `@vtex-email/preview` in its own project. The `tooling/external-install/external-install.ts` proof packs tarballs and installs outside the workspace, without a junction to `packages/*/src`.

## What remains out of scope

Message Center, email clients, Linux, macOS, and any Node other than the pin in ADR 0001. The Edge observation does not fill those layers.
