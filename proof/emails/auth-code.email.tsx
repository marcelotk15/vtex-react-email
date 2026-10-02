import { Section, Text } from '@react-email/components'
import { Email, Trans, Vtex } from '@vtex-email/react'

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
        <Vtex.Each
          fallback={
            <Text>
              <Trans id="auth.noHints" />
            </Text>
          }
          path="hints"
        >
          <Text>
            <Vtex.Value path="label" />
          </Text>
        </Vtex.Each>
      </Section>
    </Email>
  )
}
