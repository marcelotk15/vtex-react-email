# ADR 0004 — Preview da P2C

Consulta em 2026-10-02. Complementa o ADR 0003 e as seções 6, 13 e 16 da RFC-001. Atualizado pelo ADR 0008.

## Decisão

`@vtex-email/preview` depende de `@vtex-email/cli` (via `@vtex-email/cli/project`) e não é dependência da CLI. O comando `vtex-email dev` resolve o pacote a partir do projeto consumidor e chama `startDev` no mesmo processo. O runtime Node do Preview é o `dist/index.js` publicado; não há mais empacotamento de `entry.mjs` na importação.

O servidor de desenvolvimento é o Vite 7, iniciado programaticamente (ADR 0008). Ele chama `buildProject({ write: false })`, `refreshEmailFixtures`, `revalidateEmail` e `previewBuiltEmail` no mesmo processo.

O watch não grava `dist`. Uma mudança só de fixture revalida e reavalia o artefato já compilado. Forçar locale altera a cópia da fixture, não o arquivo. O iframe usa `sandbox` vazio. O endereço padrão continua `127.0.0.1:3000`. Ao encerrar, o processo fecha o servidor Vite, as conexões SSE e a sessão.

O controle “Bloquear imagens remotas” nasce desligado. Ligado, só a cópia colocada no `srcdoc` recebe `<meta http-equiv="Content-Security-Policy" content="img-src 'none'">`. A meta cobre `<img>`, `srcset` e `url()` de CSS. Os atributos originais permanecem nessa cópia, para inspeção. O HTML resolvido, a fonte Handlebars, as fixtures e `dist` não recebem a meta. Desligar o controle volta a usar o HTML resolvido, e a visualização volta a requisitar as imagens. O `sandbox` vazio não impede essas requisições; a meta existe por isso, e só na cópia exibida. Em 2026-10-02, Node `24.21.0`, `win32` `x64`, o Edge 154 headless viu a meta imediatamente depois de `<head>` só no `srcdoc`. Um servidor local, com `Cache-Control: no-store` e URLs dessa execução, recebeu zero pedidos de `img`, `srcset` e `url()` no iframe que nasceu bloqueado; desligar pediu os três; ligar de novo não acrescentou pedido; desligar outra vez voltou a pedir. Isso não observa o cliente de email.

A bancada que mostra esse documento é a do ADR 0005. O bloqueio continua só na cópia do `srcdoc` e continua desligado a cada carga.

O consumidor instala `@vtex-email/preview` no próprio projeto. A prova `proof/external-install.ts` empacota tarballs e instala fora do workspace, sem junction para `packages/*/src`.

## O que permanece fora

Message Center, clientes de email, Linux, macOS e qualquer Node que não seja o pin do ADR 0001. A observação no Edge não preenche essas camadas.
