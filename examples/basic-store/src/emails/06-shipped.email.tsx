import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

import { AddressDelivery, AddressPickup } from '../components/address'
import { PackageBlock, PackageItems } from '../components/package'
import { Logo, OrderReference, Regards, StoreShell } from '../components/shell'

export const settings = {
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

function QuantityMessage({ fullOne, fullMany }: { fullOne: string; fullMany: string }) {
  return (
    <Section>
      <Vtex.IfCond
        fallback={
          <Text className="m-0 text-sm">
            <Trans id={fullOne} />
          </Text>
        }
        operator=">"
        path="items.length"
        right={1}
      >
        <Text className="m-0 text-sm">
          <Trans id={fullMany} />
        </Text>
      </Vtex.IfCond>
    </Section>
  )
}

function ShippedBody({ cancelNotice }: { cancelNotice?: boolean }) {
  return (
    <Vtex.Each path="orders">
      <Section className="w-full px-8 py-4 max-[480px]:px-4">
        <OrderReference />
        {cancelNotice ? (
          <Text className="m-0 mt-2 text-sm font-bold">
            <Trans id="common.cantCancel" />
          </Text>
        ) : null}
        <Vtex.IfCond operator="==" path="shippingData.logisticsInfo.0.selectedDeliveryChannel" right="pickup-in-point">
          <Section>
            <QuantityMessage fullMany="shipping.pickupProducts" fullOne="shipping.pickupProduct" />
          </Section>
        </Vtex.IfCond>
        <Vtex.IfCond operator="!=" path="shippingData.logisticsInfo.0.selectedDeliveryChannel" right="pickup-in-point">
          <Section>
            <QuantityMessage fullMany="shipping.shippingProducts" fullOne="shipping.shippingProduct" />
          </Section>
        </Vtex.IfCond>
        <Vtex.RichShippingData path="shippingData">
          <Section>
            <Vtex.Group by="addressId" path="logisticsInfo">
              <Section>
                <AddressDelivery />
                <AddressPickup />
                <Vtex.Group by="packageId" path="items">
                  <Section>
                    <Vtex.IfCond
                      fallback={<PackageBlock />}
                      operator="=="
                      path="items.0.selectedDeliveryChannel"
                      right="pickup-in-point"
                    >
                      <PackageItems />
                    </Vtex.IfCond>
                  </Section>
                </Vtex.Group>
              </Section>
            </Vtex.Group>
          </Section>
        </Vtex.RichShippingData>
      </Section>
    </Vtex.Each>
  )
}

export default function Shipped() {
  return (
    <StoreShell>
      <Section className="w-full border-b border-[#dddddd] px-8 pb-4 text-center max-[480px]:px-4">
        <Logo />
      </Section>
      <ShippedBody />
      <Section className="border-t border-[#dddddd] px-8 py-3 max-[480px]:px-4">
        <Regards />
      </Section>
    </StoreShell>
  )
}

export { QuantityMessage, ShippedBody }
