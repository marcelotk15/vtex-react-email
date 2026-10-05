import { Section, Text } from '@react-email/components'
import { Trans, Vtex } from '@vtex-email/react'

export function Greeting({ namePath = 'clientProfileData.firstName' }: { namePath?: string }) {
  return (
    <Vtex.If path={namePath}>
      <Section>
        <Vtex.IfCond operator="!=" path={namePath} value="isAnonymous">
          <Text className="m-0 text-xl text-zinc-900">
            <Trans id="store.hi" />{' '}
            <span className="font-semibold">
              <Vtex.Value path={namePath} />
            </span>
          </Text>
        </Vtex.IfCond>
      </Section>
    </Vtex.If>
  )
}
