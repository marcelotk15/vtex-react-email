# CI preparada e ainda não executada

O arquivo [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) descreve a matriz que pode, no futuro, verificar a portabilidade declarada. Criar o arquivo não é evidência de execução. Este workspace não é um repositório git e não tem remoto, então o workflow ainda não rodou.

## O que a matriz contém

- Sistemas: `ubuntu-latest`, `windows-latest`, `macos-latest`.
- Node: somente `24.21.0`, o pin do ADR 0001. Outras versões ficam de fora de propósito e continuam pendentes.
- pnpm `12.8.1`, instalação com `--frozen-lockfile`.
- Em cada sistema: `pnpm typecheck`, `pnpm test`, `pnpm proof` e o build de `@vtex-email/example`.

## O que um log futuro pode promover

Um job verde promove somente aquele sistema, naquele Node, na data do log. Windows no Node `24.21.0` já tem execução local em 2026-10-02 (`win32` `x64`); um job futuro repete essa linha, não os outros sistemas. Linux e macOS permanecem pendentes até o log correspondente. Outros majors e patches de Node permanecem pendentes, porque a matriz não os executa.

A matriz não executa Message Center nem clientes de email.
