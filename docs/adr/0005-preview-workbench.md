# ADR 0005 — Bancada de preview

Consulta em 2026-10-02. Complementa o ADR 0004. A página em string HTML sai do pacote.

## Decisão

A interface de `vtex-email dev` é um aplicativo React, no navegador, servido pelo mesmo processo do preview. O contrato é `PreviewState` com `formatVersion` 1. O servidor envia o estado inteiro por `GET /api/events` e recebe a seleção em `POST /api/selection`. O snapshot acrescenta o nome do projeto, `localePath`, o arquivo e os metadados da fixture, e `data` como clone do JSON original. Forçar locale continua alterando só a cópia avaliada.

`startPreview` monta o bundle do navegador em memória com o esbuild `0.28.2`, `write: false`, `platform: 'browser'` e `NODE_ENV` de produção. O CSS vem do Tailwind `4.1.18`, compilado por `@tailwindcss/node` e `@tailwindcss/oxide`, com `source(none)` e `@source` restrito a `src/ui`. Isso separa o Tailwind da interface do Tailwind do email. `GET /` entrega o shell, sem CSP, porque o `srcdoc` do iframe herda a política da página. `GET /assets/*` entrega o JavaScript, o CSS e as fontes. Nada disso grava `dist`.

O runtime Node continua no bundle temporário descrito no ADR 0004. Esse bundle define `__VTEX_EMAIL_UI_ROOT__` com o diretório real de `src/ui`, porque a execução parte de um diretório temporário. `@tailwindcss/node` e `@tailwindcss/oxide` ficam externos, como `esbuild`, React e `@react-email/*`. O bundle do navegador rejeita `node:`, os built-ins, `@vtex-email/cli`, `@vtex-email/core`, `@vtex-email/react`, `@react-email/*` e `react-dom/server`. Tipos do contrato podem ser importados: o arquivo não tem import de runtime.

A interface usa `@base-ui/react` `1.8.0`, `react-resizable-panels` `4.14.1` e IBM Plex Sans e Mono `5.3.0` empacotados por `@fontsource`. Não há fonte por CDN. React da interface e React do compilador são instâncias distintas: a primeira entra no bundle do navegador; a segunda permanece externa no bundle Node.

A seleção vem do servidor. Um clique só destaca a fixture até o snapshot confirmar. Tamanhos de painel, recolha, aba, viewport e emails expandidos ficam em `localStorage` na chave `vtex-email.preview.ui.v1`. Fixture, payload, HTML e fonte não são persistidos. O bloqueio de imagens nasce desligado a cada carga. Gerações antigas são ignoradas. Um `POST` superado é abortado. O `srcdoc` só muda quando o documento exibido muda.

O cliente de rede escuta `offline` e `online`. O `EventSource` pode continuar aberto sem emitir erro quando o contexto fica offline; o estado visível segue o navegador.

## Medição de imagens

O bloqueio continua o do ADR 0004: a meta `img-src 'none'` entra só na cópia do `srcdoc`. Em 2026-10-02, no Edge dirigido por `playwright-core` `1.63.0`, um HTML do React Email com `<link rel="preload" as="image">` e `<img>` para `https://cdn.example/...` ainda gerou pedidos dessa URL com a meta já no `srcdoc`. A bancada não reescreve esses endereços. A prova observa a meta, os atributos originais e a ausência da meta nos arquivos do projeto.

## O que permanece fora

Clientes de email, Message Center, Linux, macOS e qualquer Node que não seja o pin do ADR 0001. `playwright-core` `1.63.0` é dependência de desenvolvimento do preview e não altera os pinos do compilador.
