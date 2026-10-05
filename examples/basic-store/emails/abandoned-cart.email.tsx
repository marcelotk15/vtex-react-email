import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Trans } from '@vtex-email/react'

import { Greeting } from '../components/store/greeting'
import { ItemGroup } from '../components/store/items'
import { StoreShell } from '../components/store/shell'

export const settings = {
  i18n: {
    localePath: 'clientPreferencesData.locale',
    output: 'per-locale',
  },
} satisfies EmailSettings

export default function AbandonedCart() {
  return (
    <StoreShell>
      <Greeting />
      <Section className="mb-6">
        <Text className="m-0 text-base leading-6 text-zinc-700">
          <Trans id="store.intro.abandonedCart" />
        </Text>
      </Section>
      <ItemGroup kind="cart" />
    </StoreShell>
  )
}
