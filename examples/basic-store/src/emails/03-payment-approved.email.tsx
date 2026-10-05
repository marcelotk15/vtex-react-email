import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

import { PaymentList } from '../components/payment'
import { Greeting, Logo, OrderReference, Regards, StoreShell } from '../components/shell'

export const settings = {
  i18n: {
    localePath: 'clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function PaymentApproved() {
  return (
    <StoreShell>
      <Section className="w-full border-b border-[#dddddd] px-8 pb-4 text-center max-[480px]:px-4">
        <Logo />
      </Section>
      <Section className="w-full px-8 py-4 max-[480px]:px-4">
        <OrderReference />
        <Greeting />
        <Text className="m-0 mt-2 text-sm">
          <Trans id="payment.approved" />
        </Text>
        <Vtex.IfCond operator="==" path="items.length" right={1}>
          <Text className="m-0 mt-2 text-sm">
            <Trans id="payment.preparingShippingOneProduct" />
          </Text>
        </Vtex.IfCond>
        <Vtex.IfCond operator=">" path="items.length" right={1}>
          <Text className="m-0 mt-2 text-sm">
            <Trans id="payment.preparingShippingManyProducts" />
          </Text>
        </Vtex.IfCond>
        <Vtex.Unless path="split">
          <Text className="mt-4 text-xl">
            <Trans id="payment.title" />
          </Text>
          <Vtex.Each path="paymentData.transactions">
            <PaymentList />
          </Vtex.Each>
        </Vtex.Unless>
      </Section>
      <Section className="border-t border-[#dddddd] px-8 py-3 max-[480px]:px-4">
        <Regards />
      </Section>
    </StoreShell>
  )
}
