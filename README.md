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
<summary><code>ifCond</code> — compare a path to a literal</summary>

`Vtex.IfCond`. Emits `{{#ifCond paymentSystemName "==" "Promissory"}}…{{/ifCond}}`. Operators accepted at compile time: `==`, `===`, and `!=`. An unknown operator fails the build. Both branches keep context.

```tsx
<Vtex.IfCond
  fallback={<Text><Vtex.Value path="paymentSystemName" /></Text>}
  operator="=="
  path="paymentSystemName"
  value="Promissory"
>
  <Text>cash</Text>
</Vtex.IfCond>
```

Evidence: experimental.

</details>

<details>
<summary><code>hasSubStr</code> — substring in the path value</summary>

`Vtex.HasSubStr`. Emits `{{#hasSubStr categoriesIds "/9293/"}}…{{/hasSubStr}}`. True when the value is not null and `String(value)` contains the literal. Both branches keep context.

```tsx
<Vtex.HasSubStr path="additionalInfo.categoriesIds" value="/9293/">
  <Text>ticket</Text>
</Vtex.HasSubStr>
```

Evidence: experimental.

</details>

<details>
<summary><code>eq</code> — strict equality with a literal</summary>

`Vtex.Eq`. Emits `{{#eq id "Items"}}…{{/eq}}`. Compares the path to a literal. Path versus path is out of scope. Both branches keep context.

```tsx
<Vtex.Eq path="id" value="Items">
  <Text>
    <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" />
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

`Vtex.Helper` with one path and two literals. Emits `{{replace shippingEstimate "bd" " business days"}}`. Replaces only the first match of the search string.

```tsx
<Vtex.Helper
  args={[expr.path('shippingEstimate'), expr.literal('bd'), expr.literal(' business days')]}
  name="replace"
/>
```

Evidence: documented.

</details>
