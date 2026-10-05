import { Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

export function OrderSummary() {
  return (
    <Section className="mb-6 rounded-lg border border-zinc-200 p-4">
      <Text className="m-0 mb-3 text-base font-semibold text-zinc-900">
        <Trans id="store.summary.title" />
      </Text>
      <Vtex.Each path="totals">
        <Section>
          <Vtex.Eq path="id" value="Items">
            <Section className="mb-2 border-b border-zinc-100 pb-2">
              <Text className="m-0 text-sm text-zinc-600">
                <Trans id="store.summary.items" />
              </Text>
              <Text className="m-0 text-right text-sm text-zinc-900">
                <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" /> $
              </Text>
            </Section>
          </Vtex.Eq>
        </Section>
      </Vtex.Each>
      <Section className="mt-2">
        <Text className="m-0 text-sm font-semibold text-zinc-900">
          <Trans id="store.summary.total" />
        </Text>
        <Text className="m-0 text-right text-sm font-semibold text-zinc-900">
          <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" /> $
        </Text>
      </Section>
    </Section>
  )
}
