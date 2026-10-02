# ADR 0003 — Locale da P2A

Consulta em 2026-10-02. Complementa o ADR 0002 e as seções 8, 13, 15 e 23 da RFC-001.

## Decisão

`defineEmail` descreve um email para todos os idiomas. O campo `locale` sai da definição e entra em `compileEmail` como o idioma daquela compilação. A mesma definição é compilada uma vez por locale. `compileEmail` continua sem receber fixture, schema ou validação de payload. A orquestração em `@vtex-email/cli` associa schema, fixtures e catálogos, combina as variantes e grava o resultado.

`i18n.localePath`, `output` e `aliases` ficam na definição. Locales e o idioma padrão vêm do email quando declarados e, caso contrário, do projeto. Um alias vira um ramo explícito no artefato combinado. O `else` final é o `defaultLocale`.

O seletor usa o bloco `eq` do perfil. Essa capacidade continua `experimental` e fora da DSL. Saída `merged` sem ela é `HBS002`, sem cair em silêncio para arquivos separados. `per-locale` não emite `eq`. O manifesto do projeto permanece `homologation: experimental`.

`validateHandlebarsSyntax` usa `precompile` e descarta o JavaScript. O arquivo gravado continua sendo HTML com Handlebars.

A validação de fixture rejeita schema com coerção, default, prefault, catch ou pipe, e também `def.coerce`. A avaliação recebe o objeto original.

O analisador de paths lê o `.def` público do Zod 4. Tipos fora do subconjunto geram `PATH_UNANALYZABLE`.

O exemplo `basic-store` deixa `unverifiedCapability` em `warning`. O padrão da configuração, quando o campo é omitido, continua `error`, como na RFC. O perfil atual não tem capacidade `verified`, então um build de produção com o padrão recusa o manifesto experimental só quando essa opção está em `error`. `unverifiedCapability` avalia a capacidade emitida no artefato. Uma capacidade experimental presente no perfil e ausente do artefato não bloqueia o build sozinha.

## O que permanece fora

Preview visual, Message Center, clientes de email e qualquer Node que não seja o pin do ADR 0001. Linux e macOS continuam sem execução.
