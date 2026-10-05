import type { EmailSettings } from '@vtex-email/core'

import { Section } from '@react-email/components'

import { Greeting } from '../components/store/greeting'
import { OrderIntro } from '../components/store/intro'
import { ItemGroup } from '../components/store/items'
import { Regards } from '../components/store/regards'
import { StoreShell } from '../components/store/shell'
import { OrderSummary } from '../components/store/summary'

export const settings = {
  i18n: {
    localePath: 'clientPreferencesData.locale',
    output: 'per-locale',
  },
} satisfies EmailSettings

export default function PaymentCanceled() {
  return (
    <StoreShell>
      <Greeting />
      <OrderIntro messageId="store.intro.paymentCanceled" />
      <OrderSummary />
      <ItemGroup kind="order" />
      <Section>
        <Regards />
      </Section>
    </StoreShell>
  )
}
