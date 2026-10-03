import { evaluateArtifact } from '@vtex-email/core'
import { p0Profile } from '@vtex-email/vtex'
import { describe, expect, it } from 'vitest'

import { AuthCode } from '../golden-fixtures/emails/auth-code.email'
import { OrderConfirmed } from '../golden-fixtures/emails/order-confirmed.email'
import { goldenTailwind } from '../golden-fixtures/tailwind'
import { compileEmail } from './compile/compile-email'

const catalog = {
  'auth.title': 'Your code',
  'auth.active': 'Still valid',
  'auth.noHints': 'No hints',
}

const orderCatalog = {
  'order.confirmed.title': 'Order confirmed',
  'order.number': 'Order',
  'common.hello': 'Hello',
  'order.view': 'View order',
  'order.pickup': 'Store pickup',
}

function authInput() {
  return {
    email: {
      id: 'auth-code',
      event: 'auth-code',
      template: AuthCode,
    },
    locale: 'pt-BR',
    catalog,
    profile: p0Profile,
    tailwind: goldenTailwind,
    file: 'packages/react/golden-fixtures/emails/auth-code.email.tsx',
  }
}

describe('template reuse', () => {
  it('compiles a second template with the same API and stable bytes', async () => {
    const first = await compileEmail(authInput())
    const order = await compileEmail({
      email: {
        id: 'order-confirmed',
        event: 'order-confirmed',
        template: OrderConfirmed,
      },
      locale: 'en-US',
      catalog: orderCatalog,
      profile: p0Profile,
      tailwind: goldenTailwind,
    })
    const second = await compileEmail(authInput())
    const [left, right] = await Promise.all([compileEmail(authInput()), compileEmail(authInput())])

    expect(first.ok && second.ok && order.ok && left.ok && right.ok).toBe(true)
    if (!first.ok || !second.ok || !order.ok || !left.ok || !right.ok) return
    const artifact = first.artifacts[0]
    expect(artifact?.content).toBe(second.artifacts[0]?.content)
    expect(artifact?.content).toBe(left.artifacts[0]?.content)
    expect(artifact?.content).toBe(right.artifacts[0]?.content)
    expect(artifact?.sha256).toBe(second.artifacts[0]?.sha256)
    expect(artifact?.content.includes('{{#unless expired}}')).toBe(true)
    expect(artifact?.content.includes('{{#each hints}}')).toBe(true)
    expect(artifact?.content.includes('{{else}}')).toBe(true)
    expect(artifact?.content.includes('SECRET-CODE')).toBe(false)
    expect(order.artifacts[0]?.content.includes('{{#each orders}}')).toBe(true)
    expect(order.artifacts[0]?.content.includes('{{code}}')).toBe(false)
    expect(artifact?.content.includes('{{#each orders}}')).toBe(false)

    const active = evaluateArtifact({
      source: artifact?.content ?? '',
      data: { code: 'SECRET-CODE', expired: false, hints: [{ label: 'sms' }] },
      profile: p0Profile,
      simulator: p0Profile,
    })
    const empty = evaluateArtifact({
      source: artifact?.content ?? '',
      data: { code: 'OTHER-CODE', expired: true, hints: [] },
      profile: p0Profile,
      simulator: p0Profile,
    })
    expect(active).toContain('SECRET-CODE')
    expect(active).toContain('sms')
    expect(active).toContain('Still valid')
    expect(empty).toContain('OTHER-CODE')
    expect(empty).toContain('No hints')
    expect(empty.includes('Still valid')).toBe(false)
    expect(empty.includes('sms')).toBe(false)
  })
})
