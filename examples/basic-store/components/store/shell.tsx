import type { ReactNode } from 'react'

import { Section, Text } from '@react-email/components'
import { Email, Trans } from '@vtex-email/react'

export function StoreShell({ children }: { children: ReactNode }) {
  return (
    <Email className="m-0 bg-zinc-50 font-sans text-zinc-900">
      <Section className="mx-auto max-w-[600px] bg-white p-0">
        <StoreHeader />
        <Section className="px-6 py-6 sm:px-4">{children}</Section>
        <StoreFooter />
      </Section>
    </Email>
  )
}

export function StoreHeader() {
  return (
    <Section className="border-b border-zinc-200 px-6 py-5 sm:px-4">
      <Text className="m-0 text-sm font-medium tracking-wide text-zinc-500 uppercase">
        <Trans id="store.brand" />
      </Text>
    </Section>
  )
}

export function StoreFooter() {
  return (
    <Section className="border-t border-zinc-200 px-6 py-5 sm:px-4">
      <Text className="m-0 text-xs text-zinc-500">
        <Trans id="store.footer" />
      </Text>
    </Section>
  )
}
