# ADR 0006 — Mapa interno da toolchain

Consulta em 2026-10-02. Complementa os ADR 0001 a 0005. Não cria pacote novo. O preview continua dependendo da CLI (ADR 0004).

## Decisão

Cada pasta tem uma responsabilidade. Não há barrel por pasta. Os únicos `index.ts` são os dos pacotes.

- `@vtex-email/core` guarda contratos (`define-email`, `diagnostics`, `profile`), `expression/`, `hbs/`, `markers/`, `schema/`, `scope/`, `compile/`, `i18n/`, `fixture/`, `runtime/` e `output/`. A compilação não lê fixtures, não avalia e não grava arquivo. `runtime/` não importa `compile/` nem `output/`. `node:fs` fica em `output/`.
- `@vtex-email/react` tem `dsl/`, `compile/` (sessão e `compileEmail`) e `adapter/`. Não usa esbuild, CLI nem preview.
- `@vtex-email/vtex` separa `capabilities.ts` de `simulator.ts`. `index.ts` só compõe `p0Profile`. O id continua `p0-message-center-experimental`.
- `@vtex-email/cli` separa `commands/` (processo e saída), `config/` e `project/` (esbuild só em `project/module-loader.ts`). `project/` não usa `process` nem stdout.
- `@vtex-email/preview` separa `shared/` (sem Node e sem DOM), `server/`, `session/`, `assets/` e `ui/`. Só `server/project-services.ts` importa valores da CLI. `session/` importa só tipos. A UI importa a UI e `shared/`. `entry.mjs` continua definindo `__VTEX_EMAIL_UI_ROOT__` com `src/ui`.

A ordem entre pacotes é `vtex → core`, `react → core`, `cli → react` e `core`, `preview → cli`.

## Contrato

Três mudanças:

- O core deixa de exportar `assertPinnedNode`. O pin de Node fica em `tooling/node-pin.ts`, usado pela configuração do Vitest e por `proof/run-proof.ts`.
- O react deixa de exportar `loadEmailEntry` e `LoadEmailResult`, e deixa de depender do esbuild. O carregamento passa para `cli/project/module-loader.ts`.
- O core passa a exportar `assembleDocument`, `findCapability`, `unverifiedCapabilityDiagnostic`, `readPathValue`, `Failure` e os tipos `BuildManifest`, `CompiledArtifact` e `CompileEmailResult`. A CLI passa a exportar `loadProjectConfig`.
- `Diagnostic` pode trazer `capability: { name, evidence }` nos `TARGET001`, para o relatório não depender do texto da mensagem.

`importBundled` continua público e delega ao mesmo carregador. `PreviewServices` permanece.

## Cache de módulos

O carregador da CLI (`project/module-loader.ts`) grava o bundle em um diretório temporário por processo e tenta apagar esse diretório depois da importação. No Windows o arquivo importado pode permanecer bloqueado até o processo encerrar; a limpeza residual ocorre no `exit`. O módulo importado permanece no cache ESM do Node até o processo encerrar; isso limita o crescimento em disco no `dev`, mas a memória do processo ainda cresce com cada URL importada.
