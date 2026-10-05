import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

export function Regards() {
  return (
    <Section className="mb-2">
      <Text className="m-0 mb-4 text-sm text-zinc-600">
        <Trans id="store.regards" />
      </Text>
      <Vtex.Button
        className="rounded-md bg-zinc-900 px-5 py-3 text-center text-sm font-medium text-white no-underline"
        href="https://example.com/account/orders"
      >
        <Trans id="store.viewOrder" />
      </Vtex.Button>
    </Section>
  )
}
