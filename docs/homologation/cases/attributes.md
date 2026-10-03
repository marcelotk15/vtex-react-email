# Dynamic attributes

Attributes covered by the product: `href`, `src`, and `alt`. `title` is also part of the DSL MVP; this case uses the three the proof resolves with a URL. There is no expression in `className`, in an attribute name, or in CSS.

## Minimal template

In [packages/react/golden-fixtures/components/item-line.tsx](../../../packages/react/golden-fixtures/components/item-line.tsx):

```tsx
<Vtex.Img alt={expr.path('name')} height={96} src={expr.path('imageUrl')} width={96} />
<Vtex.Link href={expr.path('imageUrl')}>
  <Trans id="order.view" />
</Vtex.Link>
```

A literal string in `href` is not a path. The path enters via `expr.path`.

## Synthetic JSON

`imageUrl` of the first item in the delivery fixture:

`https://example.com/images/camisa.png?x=1&y=2`

The other items use URLs without a query. The order button link uses `orderUrl` with `?ref=1&lang=en` in [packages/react/golden-fixtures/emails/order-confirmed.email.tsx](../../../packages/react/golden-fixtures/emails/order-confirmed.email.tsx).

## Expected local result

Handlebars `4.7.9`, `noEscape: false`, observed by the test `packages/react/src/golden-path.test.tsx` on 2026-10-02, Node `24.21.0`, Windows, in the resolved `src`:

`src="https://example.com/images/camisa.png?x&#x3D;1&amp;y&#x3D;2"`

Also present: `src="https://example.com/images/meia.png"` and `src="https://example.com/images/bone.png"`. The resolved document `head` does not receive those item URLs. The item `alt` carries the escaped name, under the same criterion as interpolation.

Dynamic URL scheme is not validated. The proof only shows attribute escaping.

## Message Center

Follow [the manual procedure](../message-center.md). Read the attribute HTML, not only the rendered image. Check `=` and `&` in the query.

## Evidence

Excerpt of the `src` attribute with `&#x3D;` and `&amp;`, and the matching `alt`. Layer: Message Center.

## Approval

That escaping, on those attributes, in the resolved HTML. It does not approve separate URL encoding or an attribute outside this list.

## Divergence

Record the attribute and the raw value returned. Dynamic attribute capability stays within the limit of what was seen.
