import type { EmailSettings } from '@vtex-email/core'

import { Section, Text } from '@react-email/components'
import { Email, Trans, Vtex } from '@vtex-email/react'

export const settings = {
  i18n: {
    output: 'per-locale',
  },
} satisfies EmailSettings

export default function AuthCode() {
  return (
    <Email className="m-0 bg-white font-sans">
      <Section>
        <Text>
          <Trans id="auth.title" />
        </Text>
        <Text>
          <Vtex.Value path="code" />
        </Text>
        <Vtex.Unless path="expired">
          <Text className="text-black bg-red-500">
            <Trans id="auth.active" />
          </Text>
        </Vtex.Unless>
      </Section>
    </Email>
  )
}
