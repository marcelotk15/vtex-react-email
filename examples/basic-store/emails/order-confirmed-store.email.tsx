import type { EmailSettings } from '@vtex-email/core'

import { Section } from '@react-email/components'
import { Vtex } from '@vtex-email/react'

import { Greeting } from '../components/store/greeting'
import { OrderIntro } from '../components/store/intro'
import { ItemGroup } from '../components/store/items'
import { PaymentList } from '../components/store/payment'
import { Regards } from '../components/store/regards'
import { StoreShell } from '../components/store/shell'
import { OrderSummary } from '../components/store/summary'

export const settings = {
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function OrderConfirmedStore() {
  return (
    <StoreShell>
      <Vtex.Each path="orders">
        <Section>
          <Greeting />
          <OrderIntro messageId="store.intro.confirmed" />
          <PaymentList statusMessageId="store.payment.recorded" />
          <OrderSummary />
          <ItemGroup kind="simple" />
          <Regards />
        </Section>
      </Vtex.Each>
    </StoreShell>
  )
}
