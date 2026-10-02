# ADR 0007 — Autoria por convenções e settings

Consulta em 2026-10-02. Complementa os ADR 0002, 0003 e 0006. Atualizado para `schemasDir`.

## Contexto

A API `export default defineEmail({ id, event, template, schema, fixtures, i18n })` forçava repetição em todo template. Schema e fixtures já eram responsabilidade da orquestração (CLI), não do compilador.

## Decisão

1. O módulo de email **default-exporta o componente React**. Overrides opcionais ficam em `export const settings` tipado com `EmailSettings` (`satisfies`) em `@vtex-email/core`.
2. A chave do arquivo (`fileKey`) é o basename sem o sufixo `.email.tsx`. Ela determina, por convenção, `id`, `event`, a pasta de fixtures e o arquivo de schema — mesmo se `settings.id` ou `settings.event` forem sobrescritos.
3. O projeto declara em `defineConfig`:
   - `fixturesDir` (default `fixtures`)
   - `schemasDir` (default `schemas`); schema em `{schemasDir}/{fileKey}.ts` com `export default` Zod
   - `i18n.localePath` (default de projeto; opcional)
4. Precedência por campo: `settings` → config/defaults do projeto → convenção do arquivo. Merge de `i18n` é shallow; arrays e `aliases` substituem. Valor inválido gera diagnóstico; não há fallback silencioso.
5. Fixtures: listagem não recursiva de `.json` e `.jsonc` na pasta resolvida; sidecar obrigatório `{id}.meta.json` (JSON estrito) para ambos; colisão `.json`/`.jsonc` com o mesmo id → erro. Pasta ausente → erro; pasta vazia → zero fixtures.
6. `defineEmail` é removido. A forma normalizada interna (`EmailDefinition`) permanece na CLI após a resolução.
7. O compilador continua recebendo só `{ id, event, template }`. Não lê fixtures, diretórios nem settings.

## Parsing JSONC

A CLI usa `jsonc-parser` (ESM). Comentários e trailing commas são aceitos. Erros de parse reportam arquivo, linha e coluna; valor parcial é recusado. O arquivo original no disco não é reescrito.

## Consequências

- Autoria mínima: componente + `localePath` no projeto + `{schemasDir}/{fileKey}.ts` + pasta de fixtures.
- Autocomplete via `satisfies EmailSettings` (sem plugin de linguagem).
- Watch de `.jsonc` revalida fixtures sem recompilar o template; mudança em `{schemasDir}/{fileKey}.ts` recompila o email correspondente.
- Exemplos, proof e docs migram para a nova API; sem camada de compatibilidade.
