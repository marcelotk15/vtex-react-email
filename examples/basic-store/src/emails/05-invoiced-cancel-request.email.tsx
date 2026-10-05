import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

import { PackageItems } from '../components/package'
import { Greeting, Logo, OrderReference, Regards, StoreShell } from '../components/shell'

export const settings = {
  i18n: {
    localePath: 'orders.0.clientPreferencesData.locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function InvoicedCancelRequest() {
  return (
    <StoreShell>
      <Section className="w-full border-b border-[#dddddd] px-8 pb-4 text-center max-[480px]:px-4">
        <Logo />
      </Section>
      <Vtex.Each path="orders">
        <Section className="w-full px-8 py-4 max-[480px]:px-4">
          <OrderReference />
          <Text className="m-0 mt-2 text-sm font-bold">
            <Trans id="common.cantCancel" />
          </Text>
          <Text className="m-0 mt-2 text-sm">
            <Trans id="common.cancelationInstructions" />
          </Text>
          <Greeting />
          <Text className="m-0 mt-2 text-sm">
            <Trans id="invoice.invoiced" />
          </Text>
          <Vtex.RichShippingData path="shippingData">
            <Section>
              <Vtex.Group by="packageId" path="logisticsInfo">
                <PackageItems orderItemsPath="../../../items" />
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
