import { Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

import { AddressDelivery, AddressPickup } from './address'
import { PackageBlock } from './package'

export function OrderPackages() {
  return (
    <Section>
      <Vtex.RichShippingData path="shippingData">
        <Section>
          <Vtex.Group by="addressId" path="logisticsInfo">
            <Section className="clear-both pt-3">
              <AddressDelivery />
              <AddressPickup />
              <Vtex.Group by="packageId" path="items">
                <Section>
                  <Vtex.IfCond operator=">" path="items.length" right={1}>
                    <Text className="mb-2 text-xl font-normal">
                      <Trans id="package.title" /> <Vtex.Math left={expr.path('index')} operator="+" right={1} />
                    </Text>
                  </Vtex.IfCond>
                  <PackageBlock />
                </Section>
              </Vtex.Group>
            </Section>
          </Vtex.Group>
        </Section>
      </Vtex.RichShippingData>
    </Section>
  )
}

export function ShippingSummary() {
  return (
    <Section>
      <Vtex.RichShippingData path="shippingData">
        <Section>
          <Vtex.Group by="packageId" path="logisticsInfo">
            <Section>
              <Vtex.Each path="items">
                <Section>
                  <Vtex.IfCond operator="==" path="@index" right={0}>
                    <Text className="m-0 mb-3 text-sm font-bold">
                      <Vtex.Value path="../items.length" /> <Trans id="common.lowercase.items" />
                    </Text>
                  </Vtex.IfCond>
                </Section>
              </Vtex.Each>
            </Section>
          </Vtex.Group>
        </Section>
      </Vtex.RichShippingData>
    </Section>
  )
}

export function IntroConfirmed() {
  return (
    <Section className="w-full px-8 py-4 text-sm max-[480px]:px-4">
      <Vtex.If path="orders.0.clientProfileData.firstName">
        <Section>
          <Vtex.IfCond operator="!=" path="orders.0.clientProfileData.firstName" value="isAnonymous">
            <Text className="m-0 text-sm leading-5">
              <Trans id="common.hi" />, <Vtex.Value path="orders.0.clientProfileData.firstName" />.
            </Text>
          </Vtex.IfCond>
        </Section>
      </Vtex.If>
      <Text className="m-0 mt-2">
        <Trans id="order.introMessage" />
      </Text>
      <Text className="m-0 mt-2">
        <Trans id="order.youCan" />{' '}
        <Vtex.Link className="text-[#3498db]" href={expr.path('ordersUrl')}>
          track
        </Vtex.Link>
        .
      </Text>
    </Section>
  )
}
