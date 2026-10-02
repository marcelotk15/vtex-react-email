# ADR 0004 — Preview da P2C

Consulta em 2026-10-02. Complementa o ADR 0003 e as seções 6, 13 e 16 da RFC-001.

## Decisão

`@vtex-email/preview` depende de `@vtex-email/cli` e não é dependência da CLI. O comando `vtex-email dev` resolve o pacote a partir do projeto consumidor. Como o Node não executa TSX, a entrada do preview é empacotada com o esbuild `0.28.2` já pinado, os mesmos externos da CLI e React em uma única instância. Ela chama `buildProject({ write: false })`, `refreshEmailFixtures` e `previewBuiltEmail` no mesmo processo.

O watch não grava `dist`. Uma mudança só de fixture revalida e reavalia o artefato já compilado. Forçar locale altera a cópia da fixture, não o arquivo. O iframe usa `sandbox` vazio. O endereço padrão continua `127.0.0.1:3000`. Ao encerrar, o processo fecha o servidor e os watchers.

O controle “Bloquear imagens remotas” nasce desligado. Ligado, só a cópia colocada no `srcdoc` recebe `<meta http-equiv="Content-Security-Policy" content="img-src 'none'">`. A meta cobre `<img>`, `srcset` e `url()` de CSS. Os atributos originais permanecem nessa cópia, para inspeção. O HTML resolvido, a fonte Handlebars, as fixtures e `dist` não recebem a meta. Desligar o controle volta a usar o HTML resolvido, e a visualização volta a requisitar as imagens. O `sandbox` vazio não impede essas requisições; a meta existe por isso, e só na cópia exibida. Em 2026-10-02, Node `24.21.0`, `win32` `x64`, o Edge 154 headless viu a meta imediatamente depois de `<head>` só no `srcdoc`. Um servidor local, com `Cache-Control: no-store` e URLs dessa execução, recebeu zero pedidos de `img`, `srcset` e `url()` no iframe que nasceu bloqueado; desligar pediu os três; ligar de novo não acrescentou pedido; desligar outra vez voltou a pedir. Isso não observa o cliente de email.

A bancada que mostra esse documento é a do ADR 0005. O bloqueio continua só na cópia do `srcdoc` e continua desligado a cada carga.

No monorepo, `createRequire` a partir de `examples/basic-store/vtex-email.config.ts` encontra `@vtex-email/preview`. Esse vínculo é um junction para `packages/preview`, e o Node devolve o arquivo real `packages/preview/src/entry.mjs`. A mesma busca, a partir do `package.json` da CLI, retorna `MODULE_NOT_FOUND`, porque a CLI não declara o pacote. A distribuição publicada não foi exercida. Um consumidor futuro precisa instalar `@vtex-email/preview` no próprio projeto. `entry.mjs` empacota o runtime na importação, antes de receber o caminho do projeto, e grava o arquivo num diretório temporário do sistema. O nome separa `cwd` e `pid`, e `mkdtemp` separa o processo. O arquivo fica em `.cache` desse diretório, fora do pacote instalado, de `dist` e do projeto observado pelo watch. Um atalho aponta `node_modules` para as dependências já resolvidas a partir do pacote, para os imports externos e o cache de configuração continuarem a resolver. O processo remove o atalho e o diretório ao encerrar, sem apagar o alvo. A gravação não depende de permissão de escrita na instalação.

## O que permanece fora

Message Center, clientes de email, Linux, macOS e qualquer Node que não seja o pin do ADR 0001. A observação no Edge não preenche essas camadas.
