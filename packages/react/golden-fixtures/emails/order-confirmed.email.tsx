import { Section, Text } from '@react-email/components'
import { Email, Trans, Vtex, expr } from '@vtex-email/react'

import { ItemLine } from '../components/item-line'

export function OrderConfirmed() {
  return (
    <Email className="m-0 bg-gray-100 font-sans">
      <Section className="mx-auto bg-white p-6 sm:p-4">
        <Text className="m-0 text-2xl font-bold text-brand">
          <Trans id="order.confirmed.title" />
        </Text>
        <Vtex.Each path="orders">
          <Section>
            <Text>
              <Trans id="common.hello" /> <Vtex.Value path="clientProfileData.firstName" />
            </Text>
            <Text>
              <Trans id="order.number" /> <Vtex.Value path="orderId" />
            </Text>
            <Vtex.Each path="items">
              <ItemLine />
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
            <Vtex.Button className="bg-brand px-6 py-3 text-white" href={expr.path('orderUrl')}>
              <Trans id="order.view" />
            </Vtex.Button>
          </Section>
        </Vtex.Each>
      </Section>
    </Email>
  )
}
