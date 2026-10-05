import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

import { PaymentList, Totals } from '../components/payment'
import { Logo, Regards, StoreShell } from '../components/shell'
import { OrderPackages } from '../components/shipping'

export const settings = {
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function Replaced() {
  return (
    <StoreShell>
      <Section className="w-full border-b border-[#dddddd] px-8 pb-4 text-center max-[480px]:px-4">
        <Logo />
        <Text className="m-0 text-2xl leading-9">
          <Trans id="order.titleReplaced" />
        </Text>
      </Section>
      <Section className="w-full px-8 py-4 text-sm max-[480px]:px-4">
        <Vtex.If path="orders">
          <Section>
            <Vtex.If path="orders.0.clientProfileData.firstName">
              <Section>
                <Vtex.IfCond operator="!=" path="orders.0.clientProfileData.firstName" value="isAnonymous">
                  <Text className="m-0 text-sm leading-5">
                    <Trans id="common.hi" />, <Vtex.Value path="orders.0.clientProfileData.firstName" />.
                  </Text>
                </Vtex.IfCond>
              </Section>
            </Vtex.If>
          </Section>
        </Vtex.If>
        <Text className="m-0 mt-2">
          <Trans id="order.introMessageReplaced" />
        </Text>
        <Text className="m-0 mt-2">
          <Trans id="order.youCan" />{' '}
          <Vtex.Link className="text-[#3498db]" href={expr.path('ordersUrl')}>
            track
          </Vtex.Link>
          .
        </Text>
        <Vtex.Each path="orders.0.paymentData.transactions">
          <Section>
            <Vtex.Each path="payments">
              <Section>
                <Vtex.Eq path="paymentSystemName" value="Boleto Bancário">
                  <Section className="mt-3">
                    <Text className="m-0 mb-2 text-sm">
                      <Trans id="payment.bankInvoiceReminder" />
                    </Text>
                    <Text className="m-0 text-sm">
                      <Vtex.Helper
                        args={[expr.path('url'), expr.literal('{Installment}'), expr.path('installments')]}
                        name="replace"
                      />
                    </Text>
                  </Section>
                </Vtex.Eq>
              </Section>
            </Vtex.Each>
          </Section>
        </Vtex.Each>
      </Section>
      <Vtex.IfCond operator="!=" path="split" right={true}>
        <Section className="w-full border-t border-[#dddddd] px-8 py-4 max-[480px]:px-4">
          <Text className="m-0 text-xl">
            <Trans id="payment.title" />
          </Text>
          <Vtex.Each path="orders.0.paymentData.transactions">
            <PaymentList />
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
          <Totals />
          <OrderPackages />
        </Section>
      </Vtex.Each>
      <Section className="border-t border-[#dddddd] px-8 py-3 max-[480px]:px-4">
        <Regards />
      </Section>
    </StoreShell>
  )
}
