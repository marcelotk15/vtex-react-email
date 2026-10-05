import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

import { AddressDelivery, AddressPickup } from '../components/address'
import { PackageBlock } from '../components/package'
import { Greeting, Logo, OrderReference, Regards, StoreShell } from '../components/shell'

export const settings = {
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function ShippingUpdate() {
  return (
    <StoreShell>
      <Section className="w-full border-b border-[#dddddd] px-8 pb-4 text-center max-[480px]:px-4">
        <Logo />
      </Section>
      <Vtex.Each path="orders">
        <Section className="w-full px-8 py-4 max-[480px]:px-4">
          <OrderReference />
          <Text className="m-0 mt-2 text-xl">
            <Trans id="shipping.updateTitle" />
          </Text>
          <Vtex.If path="package.courierStatus.data.0.lastChange">
            <Section className="mt-3 text-sm">
              <Text className="m-0">
                <Vtex.Helper args={[expr.path('package.courierStatus.data.0.lastChange')]} name="formatDateTime" />
              </Text>
              <Text className="m-0">
                <Vtex.Value path="package.courierStatus.data.0.description" />
              </Text>
              <Vtex.If path="package.courierStatus.data.0.city">
                <Section>
                  <Text className="m-0">
                    <Vtex.Value path="package.courierStatus.data.0.city" />
                    <Vtex.If path="package.courierStatus.data.0.state">
                      <span>
                        {' - '}
                        <Vtex.Value path="package.courierStatus.data.0.state" />
                      </span>
                    </Vtex.If>
                  </Text>
                </Section>
              </Vtex.If>
            </Section>
          </Vtex.If>
          <Greeting />
          <Vtex.IfCond
            fallback={
              <Text className="m-0 mt-2 text-sm">
                <Trans id="shipping.deliveryDetails" />
              </Text>
            }
            operator=">"
            path="package.courierStatus.data.length"
            right={1}
          >
            <Text className="m-0 mt-2 text-sm">
              <Trans id="shipping.trackDelivery" />
            </Text>
          </Vtex.IfCond>
          <Vtex.If path="package.courier">
            <Text className="m-0 mt-2 text-sm">
              <Trans id="shipping.carrier" /> <Vtex.Value path="package.courier" />
            </Text>
          </Vtex.If>
          <Text className="m-0 mt-1 text-sm">
            <Trans id="shipping.track" /> #<Vtex.Value path="package.trackingNumber" /> —{' '}
            <Trans id="shipping.history" />
          </Text>
          <Vtex.IfCond operator=">" path="package.courierStatus.data.length" right={1}>
            <Section>
              <Vtex.Each path="package.courierStatus.data">
                <Section className="mt-2 border-b border-[#dddddd] py-2 text-sm">
                  <Text className="m-0">
                    <Vtex.Helper args={[expr.path('lastChange')]} name="formatDateTime" />
                  </Text>
                  <Text className="m-0">
                    <Vtex.Value path="description" />
                  </Text>
                  <Vtex.If path="city">
                    <Section>
                      <Text className="m-0">
                        <Vtex.Value path="city" />
                        <Vtex.If path="state">
                          <span>
                            {' - '}
                            <Vtex.Value path="state" />
                          </span>
                        </Vtex.If>
                      </Text>
                    </Section>
                  </Vtex.If>
                </Section>
              </Vtex.Each>
            </Section>
          </Vtex.IfCond>
          <Vtex.RichShippingData path="shippingData">
            <Section>
              <Vtex.Group by="addressId" path="logisticsInfo">
                <Section>
                  <AddressDelivery />
                  <AddressPickup />
                  <Vtex.Group by="selectedSla" path="items">
                    <PackageBlock />
                  </Vtex.Group>
                </Section>
              </Vtex.Group>
            </Section>
          </Vtex.RichShippingData>
        </Section>
      </Vtex.Each>
      <Section className="border-t border-[#dddddd] px-8 py-3 max-[480px]:px-4">
        <Regards />
      </Section>
    </StoreShell>
  )
}
