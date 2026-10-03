# ADR 0008 — Preview com Vite e distribuição empacotada

Consulta em 2026-10-02. Complementa os ADR 0004, 0005 e 0006 e as seções 6 e 16 da RFC-001.

## Decisão

`vtex-email dev` inicia o Vite 7 (`7.3.1`) programaticamente, com `configFile: false`, `appType: 'custom'`, `strictPort: true` e host padrão `127.0.0.1`. O consumidor não cria `vite.config.ts`, não instala plugins e não copia a UI. Um `vite.config.ts` vizinho no projeto do usuário não é carregado.

A interface React é entregue como assets pré-compilados em `@vtex-email/preview/dist/client`. O `vite build` do monorepo usa `@vitejs/plugin-react@5.1.3` e `@tailwindcss/vite@4.1.18` só na construção do pacote. No consumidor, o HMR da bancada fica desligado. Mudar um email não recompila a UI.

O transporte de domínio permanece o SSE em `GET /api/events` com o `PreviewState` inteiro. O WebSocket do Vite não carrega estado de email. O HTML Handlebars permanece só no `srcdoc` do iframe.

O plugin Vite é interno ao Preview. Não há plugin público para aplicações Vite de terceiros nesta fase.

Caches do Vite ficam em `os.tmpdir()` com hash do projeto e do pid, fora do diretório observado e fora do pacote instalado. O loader de templates continua com esbuild `0.28.2` e caches temporários próprios.

Vite 8 e Tailwind acima de `4.1.18` ficam de fora: o pin do ADR 0001 e o peer de `@tailwindcss/vite@4.1.18` cobrem a linha 7. O hook `closeServer` do Vite também fica de fora do contrato; o dispose é `server.close()` chamado por `startPreview().close()`.

## Distribuição

Os pacotes emitem `dist/` com esbuild na publicação. A CLI expõe `@vtex-email/cli` (`defineConfig`) e `@vtex-email/cli/project` (orquestração). O bin é `dist/bin.js`. A prova `proof/external-install.ts` empacota tarballs, instala fora do workspace e executa `validate`, `build` e `dev`.

## O que permanece fora

Plugin Vite público, Turborepo, Vite 8, subida de React/React Email/Tailwind e qualquer capacidade VTEX `verified`.
