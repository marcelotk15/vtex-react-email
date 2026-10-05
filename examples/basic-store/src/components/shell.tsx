import type { ReactNode } from 'react'

import { Section, Text } from '@react-email/components'
import { Email, expr, Trans, Vtex } from '@vtex-email/react'

/** Official `.mw6-5` resolves to max-width 40rem (640px). `-ns` breaks at 30em (480px). */
export function StoreShell({ children }: { children: ReactNode }) {
  return (
    <Email className="m-0 bg-[#f1f1f1] font-sans text-[#2c3e50]">
      <Section className="mx-auto w-full max-w-[640px] bg-white">{children}</Section>
    </Email>
  )
}

export function Logo() {
  return (
    <Section className="mx-auto mb-3 mt-4 w-40 text-center">
      <Vtex.Img
        alt={expr.path('_accountInfo.TradingName')}
        height={80}
        src={expr.path('_accountInfo.LogoUrl')}
        style={{ maxHeight: 80 }}
        width={160}
      />
      <Vtex.Link className="text-sm text-[#3498db]" href={expr.path('_accountInfo.StoreUrl')}>
        <Text className="m-0 text-sm">
          <Vtex.Value path="_accountInfo.TradingName" />
        </Text>
      </Vtex.Link>
    </Section>
  )
}

export function Greeting() {
  return (
    <Section>
      <Vtex.If path="clientProfileData.firstName">
        <Section>
          <Vtex.IfCond operator="!=" path="clientProfileData.firstName" value="isAnonymous">
            <Text className="m-0 text-sm leading-5">
              <Trans id="common.hi" />, <Vtex.Value path="clientProfileData.firstName" />.
            </Text>
          </Vtex.IfCond>
        </Section>
      </Vtex.If>
    </Section>
  )
}

export function Regards() {
  return (
    <Text className="m-0 text-sm leading-5">
      <Trans id="common.regards" />
      <br />
      <Trans id="common.team" /> <Vtex.Value path="_accountInfo.TradingName" />
    </Text>
  )
}

export function OrderReference() {
  return (
    <Text className="m-0 text-sm leading-5">
      <Trans id="order.reference" />{' '}
      <span className="font-bold">
        #<Vtex.Value path="orderId" />
      </span>
    </Text>
  )
}
