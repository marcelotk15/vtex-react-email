import { Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

export function PackageItems({ orderItemsPath = '../../../../items' }: { orderItemsPath?: string } = {}) {
  return (
    <Section>
      <Vtex.Each path="items">
        <Section>
          <Vtex.Each path={orderItemsPath}>
            <Section>
              <Vtex.Eq path="@index" right={expr.path('../itemIndex')}>
                <Section className="py-2 text-sm">
                  <Vtex.Img alt={expr.path('name')} height={55} src={expr.path('imageUrl')} width={55} />
                  <Text className="m-0 text-sm leading-5">
                    <Vtex.Value path="name" />
                  </Text>
                  <Text className="m-0 text-sm leading-5">
                    <Vtex.Value path="quantity" /> <Trans id="common.units" />
                    <Vtex.If path="sellingPrice">
                      <span>
                        {' '}
                        <Trans id="common.currency" />{' '}
                        <Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />
                      </span>
                    </Vtex.If>
                    <Vtex.Unless path="sellingPrice">
                      <span>
                        {' '}
                        <Trans id="common.free" />
                      </span>
                    </Vtex.Unless>
                  </Text>
                  <Vtex.Each path="bundleItems">
                    <Section>
                      <Vtex.If path="name">
                        <Section className="py-2 text-sm">
                          <Vtex.Img alt={expr.path('name')} height={55} src={expr.path('imageUrl')} width={55} />
                          <Text className="m-0 text-sm leading-5">
                            <Vtex.Value path="name" />
                          </Text>
                        </Section>
                      </Vtex.If>
                    </Section>
                  </Vtex.Each>
                </Section>
              </Vtex.Eq>
            </Section>
          </Vtex.Each>
        </Section>
      </Vtex.Each>
    </Section>
  )
}

export function ShippingEstimate() {
  return (
    <Section className="text-sm">
      <Vtex.If path="../deliveryWindow">
        <Text className="m-0">
          <Trans id="shipping.scheduled" />{' '}
          <Vtex.Helper args={[expr.path('../deliveryWindow.startDateUtc')]} name="formatDate" />
        </Text>
      </Vtex.If>
      <Vtex.Unless path="../deliveryWindow">
        <Section>
          <Vtex.If path="../shippingEstimateDate">
            <Text className="m-0">
              <Vtex.Helper args={[expr.path('../shippingEstimateDate')]} name="formatDate" />
            </Text>
          </Vtex.If>
          <Vtex.Unless path="../shippingEstimateDate">
            <Text className="m-0">
              <Vtex.Value path="../shippingEstimateDays" /> <Trans id="shipping.days" />
            </Text>
          </Vtex.Unless>
        </Section>
      </Vtex.Unless>
    </Section>
  )
}

export function PackageBlock({ orderItemsPath = '../../../../items' }: { orderItemsPath?: string } = {}) {
  return (
    <Section>
      <Vtex.Each path="items">
        <Section>
          <Vtex.IfCond operator="==" path="@index" right={0}>
            <Section>
              <Vtex.Each path={orderItemsPath}>
                <Section>
                  <Vtex.Eq path="id" right={expr.path('../itemId')}>
                    <Section className="mb-2">
                      <Vtex.IfCond operator="!=" path="../selectedDeliveryChannel" right="pickup-in-point">
                        <ShippingEstimate />
                      </Vtex.IfCond>
                    </Section>
                  </Vtex.Eq>
                </Section>
              </Vtex.Each>
            </Section>
          </Vtex.IfCond>
        </Section>
      </Vtex.Each>
      <PackageItems orderItemsPath={orderItemsPath} />
    </Section>
  )
}
