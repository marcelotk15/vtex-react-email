# ADR 0002 — API de compilação da P1

Consulta em 2026-10-02. Complementa o ADR 0001 e as seções 9, 10, 11, 14, 18 e 23 da RFC-001.

## Decisão

A compilação pública produz um documento para um idioma. `compileEmail` recebe a definição do email, um catálogo, o perfil de emissão e o Tailwind. Não recebe fixture, schema nem JSON de evento.

`defineEmail` guarda `id`, `event`, `locale` e o componente. `event` é metadado local. A análise de paths contra schema de evento fica para a P2.

A avaliação é `evaluateArtifact`. Ela recebe a string já compilada, os dados e o simulador local. O compilador valida a sintaxe Handlebars com `compile` e não executa o template.

O perfil de emissão lista capacidades, forma, aridade, tipos de argumento, contexto e evidência. O simulador local é um mapa separado de funções. Uma função presente só no simulador não pode ser emitida. `formatCurrency` e `replace` permanecem `documented`. `eq` permanece `experimental` e só aparece no ensaio de merge, fora da DSL. Nada nesta fase é `verified`. O manifesto fica `experimental`.

`each` cria contexto de item; o `fallback` usa o contexto externo. `if` e `unless` preservam o contexto nos dois ramos. `../` não pode passar da raiz. Ainda não há `@root`, `@index`, `@first`, `@last`, `this`, colchetes, `With`, `Compare`, helper de bloco na DSL, iteração de objeto nem subexpressão. Uma expressão em `className` produz `DSL002`. O adaptador Tailwind consulta `className` antes de chamar o componente; o compilador converte essa falha no mesmo diagnóstico.

A gravação continua separada. `commitArtifacts` só é chamada depois de `ok`. Um nome inválido não substitui arquivos já existentes. Uma falha no meio da promoção restaura o conteúdo anterior.

## Trava de importação

O carregador do template rejeita, com `DSL001`:

- um caminho cujo segmento seja `fixtures`;
- o specifier `@vtex-email/preview`;
- o specifier `@react-email/preview`.

Essa verificação olha imports estáticos resolvidos pelo esbuild a partir da entrada. Ela não prova a pureza de um programa TypeScript. Não vê `import()` dinâmico, `fs.readFile` de um JSON, fixture recebida por prop a partir de outro módulo, nem o reexport de preview dentro de `@react-email/components`. Um erro de sintaxe do arquivo não é `DSL001`.

## O que permanece fora

O ensaio de dois documentos, com `eq` e literal, continua em `proof/run-proof.ts` como regressão. A confirmação no Message Center, nos clientes de email e em outros sistemas permanece pendente, como no ADR 0001.
