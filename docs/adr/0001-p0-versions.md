# ADR 0001 — Versões pinadas da prova P0

Consulta em 2026-10-01. As versões exatas também ficam no `pnpm-lock.yaml`.

## Decisão

A prova local fixa o conjunto abaixo. Subir qualquer um desses pacotes exige nova medição de tabela, atributo, botão, media query e de preservação dos delimitadores Handlebars.

| Pacote                    | Versão                                                                                                                      | Motivo                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                   | Versão executada `24.21.0` (`process.version` `v24.21.0`, win32 x64, 2026-10-01). `engines` e `.nvmrc` repetem essa versão. | Intervalo suportado por esta prova: somente Node `24.21.0` em Windows. React Email declara `node >= 20`. Isso não é evidência de suporte. Linux, macOS e outros majors continuam sem execução.             |
| pnpm                      | `12.8.1` no campo `packageManager`                                                                                          | Exige Node `>= 18`. `allowBuilds.esbuild` habilita o postinstall do esbuild, que o pnpm 12 ignora até a aprovação.                                                                                         |
| TypeScript                | `5.9.3`                                                                                                                     | Os pacotes do React Email são desenvolvidos com `5.9.3`. O `7.0.2` publicado como `latest` fica fora da P0.                                                                                                |
| React e React DOM         | `19.3.0`                                                                                                                    | Peer do React Email: `^18 \|\| ^19`. O par é o mesmo. O servidor do React 19 copia `src` de `<img>` para `<link rel="preload" as="image">` no `<head>`. A prova remove esse link e não reescreve a imagem. |
| `@react-email/components` | `1.0.12`                                                                                                                    | Traz `@react-email/render@2.0.6`, `@react-email/tailwind@2.0.7` e `@react-email/button@0.2.1`. `render` devolve `Promise<string>`. A prova chama `render(node, { pretty: false })`.                        |
| `tailwindcss`             | `4.1.18`                                                                                                                    | `@react-email/tailwind@2.0.7` declara `tailwindcss: ^4.1.18`. Sem override, o intervalo resolve para `4.3.3`. A documentação do componente ainda cita `4.1.12`. O override do pnpm impede essa subida.     |
| Handlebars                | `4.7.9`                                                                                                                     | Cada avaliação usa `Handlebars.create()`, com `noEscape: false` e `knownHelpersOnly: true`. Acesso a protótipo permanece no padrão desligado.                                                              |
| Zod                       | `4.6.5`                                                                                                                     | Schema da fixture com `z.looseObject()`. `safeParse` lê um clone; o preview recebe o JSON original. Sem coerce, default ou transform.                                                                      |
| Vitest                    | `5.0.3`                                                                                                                     | Único runner. JSX via oxc com runtime automático.                                                                                                                                                          |
| esbuild                   | `0.28.2`                                                                                                                    | Carrega o TSX do template. `react`, `react-dom` e `@react-email/*` ficam externos para a identidade de `Button` não ser duplicada.                                                                         |
| parse5                    | `7.3.0`                                                                                                                     | Parser HTML5 do splice e oráculo da sondagem. Entra no compilador porque o gate de texto entre linhas de tabela falhou.                                                                                    |

## Fontes

- [nodejs/Release](https://github.com/nodejs/release) e [dist/latest-v24.x](https://nodejs.org/dist/latest-v24.x/) para o LTS.
- Registro npm de cada pacote, lido na data da consulta.
- Tipos e preset publicados em `@react-email/tailwind@2.0.7` (`dist/index.d.mts` e `dist/index.mjs`): `pixelBasedPreset` converte `fontSize` e `spacing` para px.
- [Opções de runtime do Handlebars](https://handlebarsjs.com/api-reference/runtime-options.html) e [compilação](https://handlebarsjs.com/api-reference/compilation.html).

## Fora desta decisão

TypeScript 7, Tailwind `4.3.3`, `pretty: true`, Juice, minificação, Playwright e o cliente da VTEX não entram na P0.
