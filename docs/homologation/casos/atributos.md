# Atributos dinâmicos

Atributos cobertos pelo produto: `href`, `src` e `alt`. `title` também faz parte do MVP da DSL; este caso usa os três que a prova resolve com URL. Não há expressão em `className`, em nome de atributo nem em CSS.

## Template mínimo

Em [proof/components/item-line.tsx](../../../proof/components/item-line.tsx):

```tsx
<Vtex.Img alt={expr.path('name')} height={96} src={expr.path('imageUrl')} width={96} />
<Vtex.Link href={expr.path('imageUrl')}>
  <Trans id="order.view" />
</Vtex.Link>
```

Uma string literal em `href` não é path. O path entra por `expr.path`.

## JSON sintético

`imageUrl` do primeiro item da fixture de entrega:

`https://example.com/images/camisa.png?x=1&y=2`

Os outros itens usam URLs sem query. O link do botão do pedido usa `orderUrl` com `?ref=1&lang=en` em [proof/emails/order-confirmed.email.tsx](../../../proof/emails/order-confirmed.email.tsx).

## Resultado local esperado

Handlebars `4.7.9`, `noEscape: false`, observado por `pnpm proof` em 2026-10-02, Node `24.21.0`, Windows, no `src` resolvido:

`src="https://example.com/images/camisa.png?x&#x3D;1&amp;y&#x3D;2"`

Também aparecem `src="https://example.com/images/meia.png"` e `src="https://example.com/images/bone.png"`. O `head` do documento resolvido não recebe essas URLs de item. O `alt` do item carrega o nome escapado, no mesmo critério da interpolação.

URL dinâmica não é validada quanto ao esquema. A prova só mostra o escaping do atributo.

## Message Center

Seguir [o procedimento manual](../message-center.md). Ler o HTML do atributo, não só a imagem renderizada. Conferir `=` e `&` na query.

## Evidência

Trecho do atributo `src` com `&#x3D;` e `&amp;`, e o `alt` correspondente. Camada: Message Center.

## Aprovação

Esse escaping, nesses atributos, no HTML resolvido. Não aprova encoding de URL separado nem atributo fora dessa lista.

## Divergência

Registrar o atributo e o valor bruto devolvido. A capacidade de atributo dinâmico continua no limite do que foi visto.
