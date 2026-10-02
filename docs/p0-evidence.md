# Evidência da prova P0

Fechamento local em 2026-10-01. `process.version` `v24.21.0`, plataforma `win32` `x64`. A prova mede o compilador nessa execução. Não homologa Message Center, Gmail, Outlook, Linux nem macOS.

Comandos que passaram nesta máquina:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm proof
```

`pnpm proof` compila o template de confirmação e avalia as duas fixtures pela API Node. Não sobe servidor e não é a CLI da seção 17 da RFC.

## O que o fonte do React Email comprova

Lido em `@react-email/tailwind@2.0.7` e `@react-email/button@0.2.1`:

- `mapReactTree` chama componente personalizado como função. Isso quebra hooks. A P0 registra a compilação em `AsyncLocalStorage`, sem Context React.
- `Body`, `Button`, `Img`, `Link` e `Text` entram na lista de elementos nativos. `Head` e `Row` são expandidos.
- Há duas passagens, de coleta e de inline. Classe simples vira `style`. Classe de media query permanece no elemento com nome sanitizado (`sm:p-4` vira `sm_p-4`) e a regra vai para `<style>` dentro de `<head>`.
- O inline faz `{ ...estilosTailwind, ...styleExistente }`. O `style` anterior ganha.
- O filho do `Button` aparece uma vez. Os comentários `<!--[if mso]>` inserem espaçadores, sem copiar o filho.
- `setupTailwind` guarda um `Map` global `promiseStates` pela chave da config. Compilações com a mesma config compartilham o setup.

## O que a sondagem local mediu

Arquivo: `packages/react/src/render-probe.test.tsx`. `pretty: false`.

| Caso                                                  | Medição                                                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Componente com classe interna                         | Chamado uma vez. `text-sm` aparece como `14px`.                                                                                                             |
| Tokens em `td`, `href`, `src`, `alt` e filho do botão | Permanecem inteiros na string renderizada.                                                                                                                  |
| Texto dentro de `Text`                                | O pai imediato no parse5 é `p`, porque `Text` renderiza um parágrafo.                                                                                       |
| Texto irmão de `<tr>`                                 | Continua na string, mas o parse5 o coloca em `td`. O pai deixa de ser `tbody`.                                                                              |
| Filho do `Button`                                     | Uma cópia. O espaçador MSO não corta o token.                                                                                                               |
| Classe `sm:p-4`                                       | A `<style>` contém `@media` e o elemento conserva `sm_p-4`.                                                                                                 |
| Sentinela de fixture                                  | Ausente do HTML compilado.                                                                                                                                  |
| Duas renders concorrentes com a mesma config Tailwind | O `AsyncLocalStorage` de cada chamada permanece isolado. As cores `17,34,51` e `68,85,102` não se misturam. O cache global do setup é compartilhado e puro. |
| Offsets do parse5                                     | O recorte `startOffset`/`endOffset` reproduz o elemento original, inclusive o atributo de âncora. O recorte do `href` contém o token.                       |

## Transporte adotado

O gate da seção 11.3 falhou no texto entre linhas: o pai HTML5 medido pelo parse5 difere do pai escrito pelo React. A P0 usa splice estrutural.

- Cada sítio dinâmico recebe um token opaco `vtx` mais 20 caracteres hexadecimais. A identidade é tipo, índice, path e detalhe. Locale e fixture não entram no id.
- A âncora de bloco continua `data-anchor`. O lexer só reconhece `vtx` mais 20 hexadecimais com vizinhos que não sejam hex. `data-vtx`, a palavra `vtx` e `vtx-logo` não são marcadores. Token completo desconhecido, truncado, partido, escapado, colado a hex ou com contagem errada emite `TOK001`.
- O parse5 informa início e fim na string original. O compilador insere os delimitadores nesses offsets e remove a âncora. Texto, abertura e alternativa exigem tag de fechamento explícita (`endTag`). Sem ela, `TOK001`. Um fragmento ou mais de um filho na região emite `DSL002`.
- O documento não é serializado de novo depois do parse.
- O React 19 copia o `src` de `<img>` para `<link rel="preload" as="image">` no `<head>`, fora de `each` e `if`. O splice apaga esse elemento. A `<img>` conserva `src`, `alt`, `width` e `height`. Outra cópia do mesmo token emite `TOK001`. Restaurar o token no `<head>` não preserva o contexto Handlebars.
- HTML anterior à restauração que já contenha `{{` emite `HBS001`. O par `}}` de uma media query aninhada é CSS, não delimitador, e permanece.
- Falha de marcador ou de catálogo não promove arquivo.

## O que a prova de ponta a ponta mediu

Template `proof/emails/order-confirmed.email.tsx`, fixtures sintéticas de entrega (`en-US`) e retirada (sem locale), catálogos `pt-BR` e `en-US`.

- A compilação não recebe a fixture. A ausência de `ORD-A`, nomes, ruas, `20000` e `200,00` no artefato é o que mostra que o build não congela a fixture. Comparar o hash de duas compilações sem passar a fixture adiantada não mede isso.
- As duas fixtures produzem previews diferentes. O preview avalia a mesma string gravada em disco.
- Depois da restauração não resta token opaco completo. Texto comum com `vtx` não é, por si, marcador. O artefato não contém `rel="preload"`. As URLs de item ficam no `src` do loop.
- O artefato contém `{{#each orders}}`, `{{#each items}}`, `{{#if shippingData.address}}`, `{{else}}`, `{{../orderId}}`, `{{formatCurrency sellingPrice}}` e `{{replace shippingEstimate "bd" " business days"}}`, balanceados.
- Cada item do pedido `ORD-A` mostra o `orderId` do pai. O mesmo vale para o único item de `ORD-B`.
- Endereço presente mostra a rua. Ausência mostra a alternativa traduzida.
- Texto dinâmico escapa `&`, aspas e `<`. Unicode permanece legível. Em atributo, o Handlebars 4.7 também escapa `=` como `&#x3D;`.
- `@media`, `sm_p-4` e `<!--[if mso]>` permanecem no artefato.
- A fonte combinada tem dois documentos. Cada preview tem um `doctype`, um `html`, um `head` e um `body`, contados na string resolvida. Um segundo `<html>` nessa string emite `HTML001`. A contagem não passa por parser.
- Locale ausente e locale `fr-FR` caem em `pt-BR`.
- Chave de catálogo ausente emite `I18N001` e não cria arquivo. Token truncado emite `TOK001` e também não cria arquivo.
- Duas compilações simultâneas com catálogos `TITLE-AAA` e `TITLE-BBB` não trocam título. Duas outras, com `orderId` e `orderUrl`, não trocam a expressão. A sondagem de cores usa outro `AsyncLocalStorage`, não a sessão do compilador.
- A saída usa LF. O artefato é gravado em `proof/out/with space/order-confirmed.html` só depois do sucesso.

## Estado de evidência dos helpers

| Capacidade       | Estado                                           | Limite                                                                                                                 |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `each`           | documentado                                      | Helper nativo do Handlebars. Não foi executado no Message Center.                                                      |
| `if`             | documentado                                      | Truthiness do Handlebars.                                                                                              |
| `../`            | documentado                                      | Path pai do Handlebars. O envelope real do evento VTEX continua na P1.                                                 |
| `formatCurrency` | documentado para `20000` → `200,00`, sem símbolo | Os demais inteiros seguem o mesmo simulador local de centavos. Isso não é paridade VTEX.                               |
| `replace`        | documentado para uma ocorrência                  | Path mais dois literais, como o exemplo `8bd`.                                                                         |
| `eq` com literal | experimental                                     | O exemplo oficial compara dois paths. A prova usa o literal só para selecionar `en-US` na raiz do documento combinado. |

O manifesto marca `homologation: experimental`.

## Classificação

- Comprovada pelo teste e pelo código: remoção do preload de imagem dinâmica, preservação do `src` original, duas URLs de item sem `imageUrl` na raiz, imagem de condição falsa ausente do documento resolvido, fechamento explícito, vizinhos estáticos fora do bloco, `DSL002` para fragmento e raiz múltipla, lexer que ignora `vtx` solto e rejeita token corrompido, isolamento de catálogo e de paths distintos, contagem textual de um único `html`/`head`/`body` na string resolvida, pins do lockfile, Node `24.21.0` nesta execução Windows.
- Parcialmente comprovada: a fixture não entra no artefato, pela ausência dos sentinelas e porque `compileEmail` não lê a fixture. O hash de duas compilações idênticas não demonstra isso.
- Hipótese que o código rejeita: reescrever o preload no `<head>` seria equivalente ao `src` dentro do `each` ou do `if`.
- Pendência externa: Message Center, clientes de email, Linux, macOS e qualquer Node que não seja `24.21.0`.

## Gates externos pendentes

Estes itens não bloqueiam a prova local e não estão verificados:

- Message Center aceitar o HTML combinado, o `eq` com literal, `formatCurrency`, `replace`, o escaping e o contexto `../`.
- Clientes reais de email, inclusive Outlook clássico, para layout, media query e comentários MSO.
- Linux e macOS. Esta execução cobre Windows. O script em Node não depende de Bash nem de PowerShell; a execução nos outros dois sistemas fica para a CI.

## Limitações que a P1 herda

- Juice, minificação e `pretty: true` continuam desligados.
- Cada região de bloco da DSL tem um único elemento raiz, para existir uma âncora.
- `Trans` lê só string estática do catálogo. Sem placeholder, plural ou HTML na mensagem.
- URLs estáticas aceitam `https`, `mailto` e `tel`. URL dinâmica não é conferida quanto ao esquema.
- O path de locale da prova é a fixture sintética `orders.0.clientPreferencesData.locale`.
