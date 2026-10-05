# ifCond, hasSubStr, group, eq, math, with, richShippingData, dates, and @index

Current state: all listed below remain `experimental` until Message Center records exist. They exist so store templates can migrate to the React DSL with an explicit local contract.

## Inventory from the reference store

Used by the eleven official templates under [examples/basic-store/src](../../../examples/basic-store/src):

| Helper             | Form         | DSL                                 | Notes                                                                  |
| ------------------ | ------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| `ifCond`           | block        | `Vtex.IfCond`                       | Operators `==`, `===`, `!=`, `<`, `<=`, `>`, `>=`; right is expression |
| `hasSubStr`        | block        | `Vtex.HasSubStr`                    | Search is expression                                                   |
| `group`            | block        | `Vtex.Group`                        | Hash `by` identifier; item context `{ index, value, items }`           |
| `eq`               | block        | `Vtex.Eq`                           | Right is expression; also used by locale merge                         |
| `with`             | block        | `Vtex.With`                         | Positive branch uses the object; fallback uses outer context           |
| `math`             | inline/block | `Vtex.Math`                         | Operators `+ - * / %`; non-finite preview fails                        |
| `richShippingData` | block        | `Vtex.RichShippingData`             | Clones before deriving SLA fields; see ADR 0010                        |
| `formatDate`       | inline       | `Vtex.Helper name="formatDate"`     | Local `dd/MM/yyyy`                                                     |
| `formatTime`       | inline       | `Vtex.Helper name="formatTime"`     | Local `HH:mm`                                                          |
| `formatDateTime`   | inline       | `Vtex.Helper name="formatDateTime"` | Local `dd/MM/yyyy HH:mm:ss`                                            |
| `replace`          | inline       | `Vtex.Helper name="replace"`        | Path plus two expressions; first occurrence                            |
| `@index`           | path         | `Vtex.Value path="@index"`          | Only inside `each`                                                     |

Already available and reused: `each`, `if`, `unless`, `../`, `formatCurrency`.

Not emitted:

| Helper                                 | Reason                                  |
| -------------------------------------- | --------------------------------------- |
| `compare`                              | Map to `ifCond`; name is not emitted    |
| `eval`                                 | Executes JavaScript                     |
| `formatUSDate`, `formatDateNoTimezone` | Unused by the eleven official templates |
| `&&` / `\|\|` in `ifCond`              | Out of scope                            |
| `isMoreThanOneDay`, `addDaysToDate`    | Out of scope                            |

## Minimal template

```tsx
<Vtex.IfCond fallback={<Text>other</Text>} operator=">" path="items.length" right={1}>
  <Text>many</Text>
</Vtex.IfCond>
<Vtex.Eq path="@index" right={expr.path('../itemIndex')}>
  <Text>
    <Vtex.Value path="name" />
  </Text>
</Vtex.Eq>
<Vtex.Math left={expr.path('index')} operator="+" right={1} />
<Vtex.With path="shippingData">
  <Text>
    <Vtex.Value path="addressId" />
  </Text>
</Vtex.With>
<Vtex.RichShippingData path="shippingData">
  <Vtex.Group by="addressId" path="logisticsInfo">
    <Section>
      <Vtex.Value path="value" />
    </Section>
  </Vtex.Group>
</Vtex.RichShippingData>
<Vtex.Helper args={[expr.path('dueDate')]} name="formatDateTime" />
```

The artifact contains the Handlebars forms. Fixture values do not appear in the compiled HTML.

## Local simulator

- `ifCond` / `hasSubStr` / `eq` / `with` fallback: preserve or restore context as in Handlebars (`../` climbs one frame).
- `group`: empty or missing list uses the fallback; does not invent keys.
- `math`: refuses non-finite results in preview.
- Dates: host `Date` parsing; ISO offsets honored; invalid values are diagnostics, not `NaN`.
- `formatCurrency`: still `20000` → `200,00` without thousands separators.
- `richShippingData`: clones before mutating derived fields; see [ADR 0010](../../adr/0010-rich-shipping-data.md).

## Examples

Migrations live under [examples/basic-store/src](../../../examples/basic-store/src): eleven `*.email.tsx` files, shared components in `src/components/`, fixtures in `src/fixtures/`, schemas in `src/schemas/`, catalogs in `src/locales/`. Config paths are relative to `configDir`.

## Visual check (local artifact)

With the same synthetic fixture, compare the compiled preview at desktop (content max-width 640px) and mobile (375px). Criteria: section order, width, resolved colors (`#f1f1f1`, white, `#2ecc71`), tables, buttons, images, and the 480px (`30em` / `ns`) break. The `dist` HTML keeps Handlebars expressions. This does not homologate Message Center.

## Message Center

Follow [the manual procedure](../message-center.md). Do not promote evidence to `verified` from the private reference project alone.

## Approval

No approval yet. Keep `experimental` until each helper has its own Message Center record.
