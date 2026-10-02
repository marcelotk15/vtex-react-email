import { Section, Text } from '@react-email/components'
import { defineEmail } from '@vtex-email/core'
import { Email, Trans, Vtex } from '@vtex-email/react'

import { AuthCodeSchema } from '../schemas/auth-code'

export function AuthCode() {
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
          <Text>
            <Trans id="auth.active" />
          </Text>
        </Vtex.Unless>
      </Section>
    </Email>
  )
}

export default defineEmail({
  id: 'auth-code',
  event: 'auth-code',
  template: AuthCode,
  schema: AuthCodeSchema,
  fixtures: 'fixtures/auth-code/*.json',
  i18n: {
    localePath: 'locale',
    output: 'per-locale',
  },
})
