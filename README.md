# vtex-react-email

Toolchain for VTEX transactional templates in React/TSX (React Email + Tailwind). Compilation produces email-ready HTML/CSS with Handlebars expressions that Message Center evaluates at runtime.

React owns layout and typography. Order, customer, and payment data stay in the event JSON. Local preview runs the compiled artifact with Handlebars and a fixture; there is no second React interpreter for conditionals, loops, or helpers.

```tsx
import { expr, Vtex } from '@vtex-email/react'
```

Evidence: `documented` covers the pair seen in VTEX documentation; `experimental` has a local simulator contract and no Message Center record yet.

## Helpers

<details>
<summary><code>each</code> — iterate an array</summary>

`Vtex.Each`. Emits `{{#each items}}…{{/each}}`. The item becomes the current context; `fallback` uses the outer context. Inside the block, `../` climbs one level and cannot go past the root. `@index` (zero-based) is only available here — emits `{{@index}}`.

```tsx
<Vtex.Each fallback={<Text>empty</Text>} path="items">
  <Text>
    #<Vtex.Value path="@index" /> <Vtex.Value path="name" />
  </Text>
</Vtex.Each>
```

Evidence: documented (`each`, `../`); experimental (`@index`).

</details>

<details>
<summary><code>if</code> — truthiness conditional</summary>

`Vtex.If`. Emits `{{#if path}}…{{/if}}`. Follows Handlebars truthiness: `0`, empty string, and empty array are false. Both branches keep the current context.

```tsx
<Vtex.If fallback={<Text>no name</Text>} path="clientProfileData.firstName">
  <Text>
    <Vtex.Value path="clientProfileData.firstName" />
  </Text>
</Vtex.If>
```

Evidence: documented.

</details>

<details>
<summary><code>unless</code> — negation of <code>if</code></summary>

`Vtex.Unless`. Emits `{{#unless expired}}…{{/unless}}`. Negation of `if`. Both branches keep the current context.

```tsx
<Vtex.Unless path="expired">
  <Text>code still valid</Text>
</Vtex.Unless>
```

Evidence: documented.

</details>

<details>
<summary><code>ifCond</code> — compare expressions</summary>

`Vtex.IfCond`. Emits `{{#ifCond items.length ">" 1}}…{{/ifCond}}`. Operators: `==`, `===`, `!=`, `<`, `<=`, `>`, `>=`. Right operand is an expression (`expr.path` / `expr.literal`); string `value` remains literal sugar. Both branches keep context.

```tsx
<Vtex.IfCond fallback={<Text>one</Text>} operator=">" path="items.length" right={1}>
  <Text>many</Text>
</Vtex.IfCond>
```

Evidence: experimental.

</details>

<details>
<summary><code>hasSubStr</code> — substring search</summary>

`Vtex.HasSubStr`. Emits `{{#hasSubStr categoriesIds "/9293/"}}…{{/hasSubStr}}`. Search is an expression. True when the value is not null and `String(value)` contains the search string. Both branches keep context.

```tsx
<Vtex.HasSubStr path="additionalInfo.categoriesIds" search={expr.literal('/9293/')}>
  <Text>ticket</Text>
</Vtex.HasSubStr>
```

Evidence: experimental.

</details>

<details>
<summary><code>eq</code> — strict equality</summary>

`Vtex.Eq`. Emits `{{#eq id "Items"}}…{{/eq}}` or path versus path via `right={expr.path(...)}`. Both branches keep context. Locale merge also emits `eq` with a literal selector.

```tsx
<Vtex.Eq path="@index" right={expr.path('../itemIndex')}>
  <Text>
    <Vtex.Value path="name" />
  </Text>
</Vtex.Eq>
```

Evidence: experimental.

</details>

<details>
<summary><code>group</code> — group an array by a property</summary>

`Vtex.Group`. Emits `{{#group items by="packageId"}}…{{/group}}`. The `by` hash must be an identifier. Item context is `{ index, value, items }`. An empty or missing list uses the outer `fallback`. Does not invent keys. `@index` is not available inside `group` (only inside `each`).

```tsx
<Vtex.Group by="packageId" fallback={<Text>no items</Text>} path="items">
  <Section>
    <Vtex.Each path="items">
      <Text>
        <Vtex.Value path="name" />
      </Text>
    </Vtex.Each>
  </Section>
</Vtex.Group>
```

Evidence: experimental.

</details>

<details>
<summary><code>formatCurrency</code> — integer cents, no symbol</summary>

`Vtex.Helper` with one path. Emits `{{formatCurrency sellingPrice}}`. The documented pair is `20000` → `200,00`, with no currency symbol and no thousands separator. Other integers follow the same local simulator (divide by 100, two cent digits).

```tsx
<Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />
```

Evidence: documented for the pair `20000` → `200,00`.

</details>

<details>
<summary><code>formatDate</code> — local date <code>dd/MM/yyyy</code></summary>

`Vtex.Helper` with a `Date`-parseable path. Emits `{{formatDate dueDate}}`. Local output is `dd/MM/yyyy`. Timezone follows the host `Date`; there is no verified Message Center parity.

```tsx
<Vtex.Helper args={[expr.path('dueDate')]} name="formatDate" />
```

Evidence: experimental.

</details>

<details>
<summary><code>replace</code> — replace the first occurrence</summary>

`Vtex.Helper` with one path and two expressions. Emits `{{replace url "{Installment}" installments}}`. Replaces only the first match.

```tsx
<Vtex.Helper args={[expr.path('url'), expr.literal('{Installment}'), expr.path('installments')]} name="replace" />
```

Evidence: documented.

</details>
