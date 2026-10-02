# Email completo com payload sintético

Este caso reúne, num template só, os comportamentos dos casos em [casos/](casos/). Ele não substitui o registro de cada comportamento. O que este payload não exercita continua de fora.

O JSON é sintético. [proof/fixtures/order-confirmed/delivery.meta.json](../../proof/fixtures/order-confirmed/delivery.meta.json) já diz que não é o envelope real da VTEX. Usá-lo no Message Center não confirma o contrato do evento.

## Template

[proof/emails/order-confirmed.email.tsx](../../proof/emails/order-confirmed.email.tsx), com [proof/components/item-line.tsx](../../proof/components/item-line.tsx). Há dois idiomas, `pt-BR` e `en-US`, selecionados por `orders.0.clientPreferencesData.locale`. A prova combina os documentos com `eq`. O exemplo da loja acrescenta o alias `pt-br`; a prova completa, a que gera as strings abaixo, não declara esse alias. O alias fica no caso de locale.

O template inclui `each` aninhado, `../orderId`, `if` com alternativa, `formatCurrency`, `replace`, `src`, `alt` e `href` dinâmicos, e texto com `&`, aspas e Unicode.

## JSON

- Entrega, vários itens, caracteres especiais, preços `20000`, `0` e `1500`, imagens remotas: [proof/fixtures/order-confirmed/delivery.json](../../proof/fixtures/order-confirmed/delivery.json).
- Retirada, sem endereço, locale ausente, texto de fallback: [proof/fixtures/order-confirmed/pickup.json](../../proof/fixtures/order-confirmed/pickup.json).

Campo extra `sellerNote` na entrega é preservado pela forma loose do schema e não é consumido pelo template. Isso não descreve o envelope real.

## Resultado local esperado

`pnpm proof` passou em 2026-10-02, Node `24.21.0`, `win32` `x64`, Handlebars `4.7.9`, `@react-email/components` `1.0.12`, Tailwind `4.1.18`, perfil `p0-message-center-experimental`, manifesto `homologation: experimental`.

No artefato: loops, `../`, `if`/`else`, `formatCurrency`, `replace`, `@media`, `sm_p-4` e comentário `<!--[if mso]>`. Sem fixture congelada, sem `200,00` pré-calculado, sem script e sem token interno.

No preview da entrega em inglês: três itens, `ORD-A` duas vezes e `ORD-B` uma, escaping de `Ana & "Lia" <João>`, URLs de imagem com `&#x3D;` na query, `200,00`, `0,00`, `8 business days`, `3 business days`, ruas presentes, um único documento, título `Order confirmed`.

No preview da retirada: título `Pedido confirmado`, texto `Retirada na loja`, sem a rua da entrega, um único documento.

`1500` está no JSON. A prova não afirmou a string `15,00`. Negativo não está no JSON. Imagem bloqueada por cliente não foi executada.

## Message Center

Seguir [o procedimento manual](message-center.md) com a fonte combinada da prova, primeiro com a entrega e depois com a retirada. Não enviar.

## Evidência

Dois registros, entrega e retirada, no molde de [registro.md](registro.md). Dentro de cada um, apontar quais comportamentos deste arquivo apareceram. Um registro do email completo não marca o perfil como homologado e não marca um comportamento que o recorte não mostre.

## Aprovação

Os trechos vistos coincidem com o resultado local, e a conta aceita a fonte. Cada capacidade continua com o critério do caso específico.

## Divergência

Registrar o trecho. Se a recusa for da fonte combinada, usar o caso de documento único e manter `per-locale` como alternativa explícita.
