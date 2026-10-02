import type { ReactNode } from 'react'

import { Body, Head, Html, Tailwind } from '@react-email/components'

import { getSession } from './session'

export function Email({ children, className }: { children: ReactNode; className?: string }) {
  const session = getSession()
  return (
    <Html lang={session.locale}>
      <Tailwind config={session.tailwind}>
        <Head />
        <Body className={className}>{children}</Body>
      </Tailwind>
    </Html>
  )
}
