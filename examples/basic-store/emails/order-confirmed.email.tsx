import { Section, Text } from '@react-email/components'
import { defineEmail } from '@vtex-email/core'
import { Email, expr, Trans, Vtex } from '@vtex-email/react'

import { OrderConfirmedSchema } from '../schemas/order-confirmed'

export function OrderConfirmed() {
  return (
    <Email className="m-0 bg-white font-sans">
      <Section className="mx-auto bg-white p-6 sm:p-4">
        <Vtex.Each path="orders">
          <Section>
            <Text>
              <Trans id="order.hello" values={{ name: expr.path('clientProfileData.firstName') }} />
            </Text>
            <Vtex.Each path="items">
              <Text className="bg-red-900 text-white text-lg">
                <Vtex.Value path="name" />
              </Text>
            </Vtex.Each>
            <Vtex.If
              fallback={
                <Text>
                  <Trans id="order.pickup" />
                </Text>
              }
              path="shippingData.address"
            >
              <Text>
                <Vtex.Value path="shippingData.address.street" />
              </Text>
            </Vtex.If>
          </Section>
        </Vtex.Each>
      </Section>
    </Email>
  )
}

export default defineEmail({
  id: 'order-confirmed',
  event: 'order-confirmed',
  template: OrderConfirmed,
  schema: OrderConfirmedSchema,
  fixtures: 'fixtures/order-confirmed/*.json',
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
})
