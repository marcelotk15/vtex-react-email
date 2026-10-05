import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

export function OrderIntro({ messageId }: { messageId: string }) {
  return (
    <Section className="mb-6">
      <Text className="m-0 mb-2 text-base leading-6 text-zinc-700">
        <Trans id={messageId} />
      </Text>
      <Text className="m-0 text-sm text-zinc-500">
        <Trans id="store.orderLabel" />{' '}
        <span className="font-medium text-zinc-900">
          #<Vtex.Value path="orderId" />
        </span>
      </Text>
    </Section>
  )
}
