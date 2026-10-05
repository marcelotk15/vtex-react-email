import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

import { PaymentList, Totals } from '../components/payment'
import { Logo, Regards, StoreShell } from '../components/shell'
import { IntroConfirmed, OrderPackages, ShippingSummary } from '../components/shipping'

export const settings = {
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function Confirmed() {
  return (
    <StoreShell>
      <Section className="w-full border-b border-[#dddddd] px-8 pb-4 text-center max-[480px]:px-4">
        <Logo />
        <Text className="m-0 text-2xl leading-9">
          <Trans id="order.title" />
        </Text>
      </Section>

      <IntroConfirmed />

      <Section className="w-full border-y-8 border-[#dddddd] px-8 py-4 max-[480px]:px-4">
        <Text className="mt-0 text-xl">
          <Trans id="shipping.summaryTitle" />
        </Text>
        <Vtex.Each path="orders">
          <Section>
            <ShippingSummary />
          </Section>
        </Vtex.Each>
      </Section>

      <Vtex.IfCond operator="!=" path="split" right={true}>
        <Section className="w-full border-t border-[#dddddd] px-8 py-4 max-[480px]:px-4">
          <Text className="m-0 text-xl">
            <Trans id="payment.title" />
          </Text>
          <Vtex.Each path="orders.0.paymentData.transactions">
            <Section>
              <PaymentList />
              <Text className="mt-2 inline-block bg-[#cccccc] px-2 py-1 text-xs">
                <Trans id="payment.pending" />
              </Text>
            </Section>
          </Vtex.Each>
        </Section>
      </Vtex.IfCond>

      <Vtex.Each path="orders">
        <Section className="w-full border-t border-[#dddddd] px-8 py-4 max-[480px]:px-4">
          <Text className="m-0 text-2xl">
            <Trans id="common.order" />{' '}
            <span className="font-medium">
              #<Vtex.Value path="orderId" />
            </span>
          </Text>
          <Text className="mt-1 mb-2 text-[#999999]">
            <Trans id="package.seller" /> <Vtex.Value path="sellers.0.name" />
          </Text>

          <Vtex.IfCond operator="==" path="../split" right={true}>
            <Section className="pb-3 align-top max-[480px]:w-full min-[480px]:float-left min-[480px]:w-1/2">
              <Text className="text-xl">
                <Trans id="payment.title" />
              </Text>
              <Vtex.Each path="paymentData.transactions">
                <Section>
                  <PaymentList />
                  <Text className="mt-2 inline-block bg-[#cccccc] px-2 py-1 text-xs">
                    <Trans id="payment.pending" />
                  </Text>
                </Section>
              </Vtex.Each>
            </Section>
          </Vtex.IfCond>

          <Totals />
          <OrderPackages />
        </Section>
      </Vtex.Each>

      <Section className="border-t border-[#dddddd] px-8 py-3 max-[480px]:px-4">
        <Text className="m-0 text-sm">
          <Trans id="shipping.estimateMessage" />
        </Text>
        <Regards />
      </Section>
    </StoreShell>
  )
}
