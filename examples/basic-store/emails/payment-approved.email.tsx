import type { EmailSettings } from '@vtex-email/core'

import { Section } from '@react-email/components'

import { Greeting } from '../components/store/greeting'
import { OrderIntro } from '../components/store/intro'
import { ItemGroup } from '../components/store/items'
import { PaymentList } from '../components/store/payment'
import { Regards } from '../components/store/regards'
import { StoreShell } from '../components/store/shell'

export const settings = {
  i18n: {
    localePath: 'clientPreferencesData.locale',
    output: 'per-locale',
  },
} satisfies EmailSettings

export default function PaymentApproved() {
  return (
    <StoreShell>
      <Greeting />
      <OrderIntro messageId="store.intro.paymentApproved" />
      <PaymentList statusMessageId="store.payment.approved" />
      <ItemGroup kind="order-ticket" />
      <Section>
        <Regards />
      </Section>
    </StoreShell>
  )
}
