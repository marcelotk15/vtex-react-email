import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

import { PackageItems } from '../components/package'
import { Greeting, Logo, OrderReference, Regards, StoreShell } from '../components/shell'

export const settings = {
  i18n: {
    localePath: 'clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

function HandlingMessage() {
  return (
    <Section>
      <Vtex.IfCond operator="==" path="shippingData.logisticsInfo.0.selectedDeliveryChannel" right="pickup-in-point">
        <Section>
          <Vtex.IfCond
            fallback={
              <Text className="m-0 text-sm">
                <Trans id="invoice.handlingProductPickup" />
              </Text>
            }
            operator=">"
            path="items.length"
            right={1}
          >
            <Text className="m-0 text-sm">
              <Trans id="invoice.handlingProductsPickup" />
            </Text>
          </Vtex.IfCond>
        </Section>
      </Vtex.IfCond>
      <Vtex.IfCond operator="!=" path="shippingData.logisticsInfo.0.selectedDeliveryChannel" right="pickup-in-point">
        <Section>
          <Vtex.IfCond
            fallback={
              <Text className="m-0 text-sm">
                <Trans id="invoice.handlingProduct" />
              </Text>
            }
            operator=">"
            path="items.length"
            right={1}
          >
            <Text className="m-0 text-sm">
              <Trans id="invoice.handlingProducts" />
            </Text>
          </Vtex.IfCond>
        </Section>
      </Vtex.IfCond>
    </Section>
  )
}

export default function Invoiced() {
  return (
    <StoreShell>
      <Section className="w-full border-b border-[#dddddd] px-8 pb-4 text-center max-[480px]:px-4">
        <Logo />
      </Section>
      <Section className="w-full px-8 py-4 max-[480px]:px-4">
        <OrderReference />
        <Greeting />
        <Text className="m-0 mt-2 text-sm">
          <Trans id="invoice.invoiced" />
        </Text>
        <HandlingMessage />
        <Vtex.RichShippingData path="shippingData">
          <Section>
            <Vtex.Group by="packageId" path="logisticsInfo">
              <Section>
                <Text className="mt-4 text-xl">
                  <Vtex.Eq
                    fallback={
                      <span>
                        <Trans id="invoice.products" />
                      </span>
                    }
                    path="items.length"
                    value={1}
                  >
                    <span>
                      <Trans id="invoice.product" />
                    </span>
                  </Vtex.Eq>
                </Text>
                <PackageItems orderItemsPath="../../../items" />
              </Section>
            </Vtex.Group>
          </Section>
        </Vtex.RichShippingData>
      </Section>
      <Section className="border-t border-[#dddddd] px-8 py-3 max-[480px]:px-4">
        <Regards />
      </Section>
    </StoreShell>
  )
}
