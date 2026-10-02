# Locale com eq, alias e fallback

Capacidade: `eq` com literal. Estado atual: `experimental`. A documentação VTEX de referência compara dois paths. O literal no seletor é simulador local até o Message Center. A DSL de template não emite `eq`; o merge do compilador emite.

## Template mínimo

Não é um componente. É a combinação de variantes. Em [examples/basic-store/emails/order-confirmed.email.tsx](../../../examples/basic-store/emails/order-confirmed.email.tsx):

```ts
i18n: {
  localePath: 'orders.0.clientPreferencesData.locale',
  output: 'merged',
  aliases: { 'pt-br': 'pt-BR' },
}
```

O teste do projeto, no mesmo Node `24.21.0` em 2026-10-02, confere no artefato combinado os literais `"en-US"` e `"pt-br"`, e a presença de `{{#eq `. A saída `per-locale` de `auth-code` não contém `eq`.

A ordem emitida, lida em `examples/basic-store/dist/order-confirmed.html` gerado por esse build, é: ramo `en-US`, depois ramo `pt-br` com o documento `pt-BR`, depois o `else` final com o mesmo documento `pt-BR`.

## JSON sintético

Três payloads já usados pelo exemplo, mais um quarto só para o alias. Todos sintéticos.

- `en-US`: [examples/basic-store/fixtures/order-confirmed/delivery.json](../../../examples/basic-store/fixtures/order-confirmed/delivery.json). O preview local contém `Hello,` e o locale do payload é `en-US`.
- Ausente: [missing-locale.json](../../../examples/basic-store/fixtures/order-confirmed/missing-locale.json). O preview local contém `Olá,`.
- Desconhecido `fr-FR`: [unknown-locale.json](../../../examples/basic-store/fixtures/order-confirmed/unknown-locale.json). O preview local contém `Olá,` e não contém `Hello,`.
- Alias: o mesmo objeto da entrega, com `orders.0.clientPreferencesData.locale` igual a `pt-br`. O teste automático confere o literal no artefato. A seleção local desse alias segue o ramo emitido: o documento `pt-BR`, porque o simulador de `eq` compara com igualdade estrita.

A prova completa, com outros catálogos, também viu `fr-FR` e locale ausente caírem em `Pedido confirmado`, sem `Order confirmed`.

## Resultado local esperado

- `en-US` resolve o documento em inglês
- `pt-br`, ausente e `fr-FR` resolvem o documento em português
- forçar locale no preview altera a cópia, não o arquivo da fixture
- o manifesto continua `homologation: experimental` e emite `TARGET001` para `eq`

## Message Center

Seguir [o procedimento manual](../message-center.md) quatro vezes. Conferir o idioma do documento resolvido, inclusive o ramo `pt-br` escrito em minúsculas.

## Evidência

Quatro recortes, um por payload, no molde de [registro.md](../registro.md). Camada: Message Center. O preview local não preenche esses registros.

## Aprovação

Cada payload no seu registro. Aceitar `en-US` não aceita o alias nem o fallback. `eq` com literal só deixa de ser `experimental` se os quatro comportamentos, e o documento único do caso seguinte, estiverem aceitos no destino. Até lá permanece `experimental`.

## Divergência

Registrar o locale enviado e o idioma que saiu. Não normalizar o alias só no preview, e não trocar o seletor em silêncio.
