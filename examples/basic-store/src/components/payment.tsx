import { Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

function PaymentLine() {
  return (
    <Section className="border-b border-[#dddddd] py-1 text-sm">
      <Text className="m-0">
        <Vtex.Value path="paymentSystemName" />
        <Vtex.If path="lastDigits">
          <span>
            {' '}
            <Trans id="payment.lastDigits" /> <Vtex.Value path="lastDigits" />
          </span>
        </Vtex.If>
        <Vtex.Eq
          fallback={
            <span>
              <Trans id="payment.in" /> <Vtex.Value path="installments" />x
            </span>
          }
          path="installments"
          value={1}
        >
          <span>
            {' '}
            <Trans id="payment.atSight" />
          </span>
        </Vtex.Eq>
        {' — '}
        <Trans id="common.currency" /> <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" />
      </Text>
    </Section>
  )
}

function PaymentSingle() {
  return (
    <Section>
      <Text className="m-0 text-sm leading-5">
        <Vtex.Value path="paymentSystemName" />
        <Vtex.If path="lastDigits">
          <span>
            {' '}
            <Trans id="payment.lastDigits" /> <Vtex.Value path="lastDigits" />
          </span>
        </Vtex.If>
      </Text>
      <Text className="m-0 text-sm leading-5">
        <Trans id="common.currency" /> <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" />
        <Vtex.Eq
          fallback={
            <span>
              <Trans id="payment.in" /> <Vtex.Value path="installments" />x
            </span>
          }
          path="installments"
          value={1}
        >
          <span>
            {' '}
            <Trans id="payment.atSight" />
          </span>
        </Vtex.Eq>
      </Text>
    </Section>
  )
}

export function PaymentList() {
  return (
    <Section>
      <Vtex.IfCond
        fallback={
          <Section>
            <Vtex.Each path="payments">
              <PaymentLine />
            </Vtex.Each>
          </Section>
        }
        operator="=="
        path="payments.length"
        right={1}
      >
        <Section>
          <Vtex.Each path="payments">
            <PaymentSingle />
          </Vtex.Each>
        </Section>
      </Vtex.IfCond>
    </Section>
  )
}

export function Totals() {
  return (
    <Section className="w-full">
      <Vtex.Each path="totals">
        <Section>
          <Vtex.If path="value">
            <Section className="border-b border-[#dddddd] py-1 text-sm">
              <Text className="m-0">
                <Vtex.Eq path="id" value="Items">
                  <span>
                    <Trans id="common.items" />
                  </span>
                </Vtex.Eq>
                <Vtex.Eq path="id" value="Shipping">
                  <span>
                    <Trans id="common.shipping" />
                  </span>
                </Vtex.Eq>
                <Vtex.Eq path="id" value="Discounts">
                  <span>
                    <Trans id="common.discounts" />
                  </span>
                </Vtex.Eq>
                <Vtex.Eq path="id" value="Tax">
                  <span>
                    <Trans id="common.taxes" />
                  </span>
                </Vtex.Eq>
                {': '}
                <Trans id="common.currency" /> <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" />
              </Text>
            </Section>
          </Vtex.If>
        </Section>
      </Vtex.Each>
      <Vtex.If path="value">
        <Text className="m-0 py-1 text-right text-sm font-medium">
          <Trans id="common.total" />: <Trans id="common.currency" />{' '}
          <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" />
        </Text>
      </Vtex.If>
    </Section>
  )
}
