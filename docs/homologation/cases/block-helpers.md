# ifCond, hasSubStr, group, eq (DSL), formatDate, and @index

Current state: all `experimental`. None of these have Message Center verification records. They exist so store templates can migrate to the React DSL with an explicit local contract.

## Inventory from the reference store

Used by the eight linked templates and implemented here:

| Helper | Form | DSL | Notes |
|--------|------|-----|-------|
| `ifCond` | block | `Vtex.IfCond` | Operators `==`, `===`, `!=` only |
| `hasSubStr` | block | `Vtex.HasSubStr` | Path plus substring literal |
| `group` | block | `Vtex.Group` | Hash `by` identifier; item context |
| `eq` | block | `Vtex.Eq` | Path plus literal; also used by locale merge |
| `formatDate` | inline | `Vtex.Helper name="formatDate"` | Local `dd/MM/yyyy` |
| `@index` | path | `Vtex.Value path="@index"` | Only inside `each` |

Already available and reused: `each`, `if`, `../`, `formatCurrency`.

Not emitted (next candidates or rejected):

| Helper | Reason |
|--------|--------|
| `compare` | Not a universal VTEX assumption; map to `ifCond` |
| `eval` | Executes JavaScript; regex in the reference does not match template placeholders |
| `richShippingData` | Mutates logistics before render; summaries read `totals` / `value` instead |
| `formatTime`, `formatDiscount`, `math` | Only in unlinked partials or unused |

## Minimal template

```tsx
<Vtex.IfCond fallback={<Text>other</Text>} operator="==" path="paymentSystemName" value="Promissory">
  <Text>cash</Text>
</Vtex.IfCond>
<Vtex.HasSubStr path="categoriesIds" value="/9293/">
  <Text>ticket</Text>
</Vtex.HasSubStr>
<Vtex.Group by="packageId" path="items">
  <Section>
    <Vtex.Each path="items">
      <Text>
        <Vtex.Value path="@index" />
      </Text>
    </Vtex.Each>
  </Section>
</Vtex.Group>
<Vtex.Eq path="id" value="Items">
  <Text>
    <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" />
  </Text>
</Vtex.Eq>
<Vtex.Helper args={[expr.path('dueDate')]} name="formatDate" />
```

The artifact contains the Handlebars forms. Fixture values such as `ORD-1001` or `560000` do not appear in the compiled HTML.

## Local simulator

- `ifCond` / `hasSubStr` / `eq`: preserve context in both branches (`../` does not need an extra hop).
- `group`: empty or missing list uses the fallback; does not invent `packageId`.
- `formatDate`: host `Date` parsing; timezone is not Message Center parity.
- `formatCurrency`: still `20000` → `200,00` without thousands separators. The reference helper’s thousands regex is broken; the toolchain does not copy that bug.

## Examples

Generic migrations live under [examples/basic-store](../../../examples/basic-store): eight `*.email.tsx` files and shared components in `components/store/`. Fixtures are anonymized JSONC.

## Message Center

Follow [the manual procedure](../message-center.md). Do not promote evidence to `verified` from the private reference project alone.

## Approval

No approval yet. Keep `experimental` until each helper has its own Message Center record.
