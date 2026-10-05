import type { EmailSettings } from '@vtex-email/core'

import { Section } from '@react-email/components'
import { Vtex } from '@vtex-email/react'

import { Greeting } from '../components/store/greeting'
import { OrderIntro } from '../components/store/intro'
import { ItemGroup } from '../components/store/items'
import { PaymentList } from '../components/store/payment'
import { Regards } from '../components/store/regards'
import { StoreShell } from '../components/store/shell'

export const settings = {
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'per-locale',
  },
} satisfies EmailSettings

export default function PaymentPending() {
  return (
    <StoreShell>
      <Vtex.Each path="orders">
        <Section>
          <Greeting />
          <OrderIntro messageId="store.intro.paymentPending" />
          <PaymentList showDueDate statusMessageId="store.payment.pending" />
          <ItemGroup kind="order" />
          <Regards />
        </Section>
      </Vtex.Each>
    </StoreShell>
  )
}
