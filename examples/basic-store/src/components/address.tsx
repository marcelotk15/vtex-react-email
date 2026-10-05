import { Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

export function AddressDelivery() {
  return (
    <Section className="mb-3 text-sm">
      <Vtex.Eq path="items.0.selectedDeliveryChannel" value="delivery">
        <Section>
          <Text className="m-0 mb-1 font-bold">
            <Trans id="shipping.address" />
          </Text>
          <Vtex.Each path="../../shippingData.availableAddresses">
            <Section>
              <Vtex.Eq path="../value" right={expr.path('addressId')}>
                <Text className="m-0 text-sm leading-5">
                  <Vtex.Value path="street" />, <Vtex.Value path="number" />
                </Text>
              </Vtex.Eq>
            </Section>
          </Vtex.Each>
        </Section>
      </Vtex.Eq>
    </Section>
  )
}

export function AddressPickup() {
  return (
    <Section className="mb-3 text-sm">
      <Vtex.Eq path="items.0.selectedDeliveryChannel" value="pickup-in-point">
        <Section>
          <Text className="m-0 mb-1 font-bold">
            <Trans id="shipping.pickup" />
          </Text>
          <Vtex.Each path="items.0.slas">
            <Section>
              <Vtex.IfCond operator="==" path="../items.0.selectedSla" right={expr.path('id')}>
                <Text className="m-0 text-sm leading-5">
                  <Vtex.Value path="pickupStoreInfo.friendlyName" />
                </Text>
              </Vtex.IfCond>
            </Section>
          </Vtex.Each>
        </Section>
      </Vtex.Eq>
    </Section>
  )
}
