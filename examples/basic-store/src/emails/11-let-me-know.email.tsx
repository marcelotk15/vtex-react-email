import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Email, expr, Trans, Vtex } from '@vtex-email/react'

export const settings = {
  i18n: {
    localePath: 'locale',
    output: 'merged',
    aliases: { 'pt-br': 'pt-BR' },
  },
} satisfies EmailSettings

export default function LetMeKnow() {
  return (
    <Email className="m-0 bg-[#f1f1f1] font-sans text-[#2c3e50]">
      <Section className="mx-auto w-full max-w-[640px] bg-white px-8 py-4">
        <Text className="m-0 text-sm">
          <Trans id="common.hi" />
        </Text>
        <Text className="m-0 mt-2 text-sm">
          <Vtex.Value path="name" />
        </Text>
        <Vtex.If path="productLink">
          <Section className="mt-3">
            <Vtex.Link
              className="inline-block rounded bg-[#2ecc71] px-3 py-2 font-medium text-white no-underline"
              href={expr.path('productLink')}
            >
              open
            </Vtex.Link>
          </Section>
        </Vtex.If>
      </Section>
    </Email>
  )
}
