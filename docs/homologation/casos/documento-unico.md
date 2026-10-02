# Template combinado em um único documento

A fonte combinada contém um documento por ramo. Depois da avaliação, o resultado local tem um `doctype`, um `html`, um `head` e um `body`. A contagem da prova é textual na string resolvida. Analisar a fonte combinada como se já fosse o email entregue não é o critério.

`eq` continua `experimental`. Este caso é a pergunta de destino sobre aceitar essa fonte.

## Template mínimo

A mesma definição `output: 'merged'` de [locale.md](locale.md). Na prova, `pnpm proof` em 2026-10-02, Node `24.21.0`, Windows, a fonte gravada em `proof/out/with space/order-confirmed.html` contém dois `<!DOCTYPE`. O exemplo da loja, com o alias, contém três documentos na fonte: inglês, alias e fallback.

## JSON sintético

O JSON de entrega e o de retirada da prova, separados. O de entrega seleciona `en-US`. O de retirada não traz locale e cai no documento padrão.

## Resultado local esperado

Observado pela prova:

- a fonte combinada da prova tem dois `<!DOCTYPE`
- o preview inglês tem um `<!DOCTYPE`
- o preview de retirada tem um `html`, um `head` e um `body`
- um segundo `html` na string resolvida seria `HTML001` na avaliação local

## Message Center

Seguir [o procedimento manual](../message-center.md). Colar a fonte combinada, não uma variante `per-locale`. Pedir o teste com o JSON de entrega e, em separado, com o de retirada. Ver se a conta aceita a fonte e se o resultado é um único email.

## Evidência

A mensagem de aceitação ou de recusa da conta, e o HTML resolvido com a contagem de `html`, `head` e `body`. Camada: Message Center.

## Aprovação

A conta aceita a fonte e cada JSON devolve um documento. Isso, junto com os quatro payloads de locale, é o que permite discutir a saída de `eq` do estado `experimental`. Sem os dois, o estado não muda.

## Divergência

Se a conta recusar a fonte, registrar a recusa. As variantes `per-locale` continuam disponíveis como modo explícito. Não alterar o merge para contornar a recusa nesta etapa.
