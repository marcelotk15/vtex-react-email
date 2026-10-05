import type { EmailSettings } from '@vtex-email/core'

import { Section } from '@react-email/components'
import { Vtex } from '@vtex-email/react'

import { AddressDelivery, AddressPickup } from '../components/address'
import { PackageBlock, PackageItems } from '../components/package'
import { Logo, OrderReference, Regards, StoreShell } from '../components/shell'
import { QuantityMessage } from './06-shipped.email'

export const settings = {
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function Delivered() {
  return (
    <StoreShell>
      <Section className="w-full border-b border-[#dddddd] px-8 pb-4 text-center max-[480px]:px-4">
        <Logo />
      </Section>
      <Vtex.Each path="orders">
        <Section className="w-full px-8 py-4 max-[480px]:px-4">
          <OrderReference />
          <Vtex.IfCond
            operator="=="
            path="shippingData.logisticsInfo.0.selectedDeliveryChannel"
            right="pickup-in-point"
          >
            <Section>
              <QuantityMessage
                fullMany="shipping.pickedUpProducts"
                fullOne="shipping.pickedUpProduct"
                partialMany="shipping.pickedUpSomeProducts"
                partialOne="shipping.pickedUpOneProduct"
              />
            </Section>
          </Vtex.IfCond>
          <Vtex.IfCond
            operator="!="
            path="shippingData.logisticsInfo.0.selectedDeliveryChannel"
            right="pickup-in-point"
          >
            <Section>
              <QuantityMessage
                fullMany="shipping.deliveredProducts"
                fullOne="shipping.deliveredProduct"
                partialMany="shipping.deliveredSomeProducts"
                partialOne="shipping.deliveredOneProduct"
              />
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
      <Section className="border-t border-[#dddddd] px-8 py-3 max-[480px]:px-4">
        <Regards />
      </Section>
    </StoreShell>
  )
}
