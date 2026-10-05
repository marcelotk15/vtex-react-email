import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

import { StoreShell } from '../components/store/shell'

export const settings = {
  i18n: {
    localePath: 'locale',
    output: 'per-locale',
  },
} satisfies EmailSettings

export default function BackInStock() {
  return (
    <StoreShell>
      <Vtex.If path="addressee.name">
        <Text className="m-0 mb-4 text-xl text-zinc-900">
          <Trans id="store.hi" />{' '}
          <span className="font-semibold">
            <Vtex.Value path="addressee.name" />
          </span>
        </Text>
      </Vtex.If>
      <Text className="m-0 mb-6 text-base leading-6 text-zinc-700">
        <Trans id="store.intro.backInStock" />
      </Text>
      <Section className="mb-6 rounded-lg border border-zinc-200 p-4">
        <Text className="m-0 text-sm font-semibold text-zinc-900">
          <Vtex.Value path="productName" />
        </Text>
        <Section className="mt-4">
          <Vtex.Button
            className="rounded-md bg-zinc-900 px-5 py-3 text-center text-sm font-medium text-white no-underline"
            href="https://example.com/product"
          >
            <Trans id="store.viewProduct" />
          </Vtex.Button>
        </Section>
      </Section>
      <Text className="m-0 text-sm text-zinc-500">
        <Trans id="store.team" />
      </Text>
    </StoreShell>
  )
}
