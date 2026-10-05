import { Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

export function PaymentTypeLabel() {
  return (
    <Vtex.IfCond
      fallback={
        <Text className="m-0 text-sm font-medium text-zinc-900">
          <Vtex.Value path="paymentSystemName" />
        </Text>
      }
      operator="=="
      path="paymentSystemName"
      value="Promissory"
    >
      <Text className="m-0 text-sm font-medium text-zinc-900">
        <Trans id="store.payment.promissory" />
      </Text>
    </Vtex.IfCond>
  )
}

function PaymentRows({ statusMessageId }: { statusMessageId: string }) {
  return (
    <Vtex.Each path="paymentData.transactions">
      <Section>
        <Vtex.Each path="payments">
          <Section className="mb-3 border-b border-zinc-100 pb-3">
            <PaymentTypeLabel />
            <Text className="m-0 mt-1 text-sm text-zinc-600">
              <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" /> $ ·{' '}
              <Vtex.Value path="installments" />x
            </Text>
            <Text className="m-0 mt-2 text-xs font-medium text-emerald-700">
              <Trans id={statusMessageId} />
            </Text>
          </Section>
        </Vtex.Each>
      </Section>
    </Vtex.Each>
  )
}

function PaymentRowsWithDueDate({ statusMessageId }: { statusMessageId: string }) {
  return (
    <Vtex.Each path="paymentData.transactions">
      <Section>
        <Vtex.Each path="payments">
          <Section className="mb-3 border-b border-zinc-100 pb-3">
            <PaymentTypeLabel />
            <Text className="m-0 mt-1 text-sm text-zinc-600">
              <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" /> $ ·{' '}
              <Vtex.Value path="installments" />x
            </Text>
            <Vtex.If
              fallback={
                <Text className="m-0 mt-1 text-xs text-zinc-500">
                  <Trans id="store.payment.noDueDate" />
                </Text>
              }
              path="dueDate"
            >
              <Text className="m-0 mt-1 text-xs text-zinc-500">
                <Trans id="store.payment.dueDate" />{' '}
                <Vtex.Helper args={[expr.path('dueDate')]} name="formatDate" />
              </Text>
            </Vtex.If>
            <Text className="m-0 mt-2 text-xs font-medium text-emerald-700">
              <Trans id={statusMessageId} />
            </Text>
          </Section>
        </Vtex.Each>
      </Section>
    </Vtex.Each>
  )
}

export function PaymentList({
  statusMessageId,
  showDueDate = false,
}: {
  statusMessageId: string
  showDueDate?: boolean
}) {
  return (
    <Section className="mb-6 rounded-lg border border-zinc-200 p-4">
      <Text className="m-0 mb-3 text-base font-semibold text-zinc-900">
        <Trans id="store.payment.title" />
      </Text>
      {showDueDate ? (
        <PaymentRowsWithDueDate statusMessageId={statusMessageId} />
      ) : (
        <PaymentRows statusMessageId={statusMessageId} />
      )}
    </Section>
  )
}
