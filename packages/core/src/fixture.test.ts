import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { checkFixture } from './fixture'
import { withForcedLocale } from './locale-value'

describe('fixture validation', () => {
  it('rejects coercion and defaults without changing the original payload', () => {
    const original = { amount: '10' }
    const coerced = checkFixture(z.object({ amount: z.coerce.number() }), original)
    expect(coerced?.code).toBe('DATA001')
    expect(original).toEqual({ amount: '10' })

    const fallback = checkFixture(z.object({ amount: z.number().default(1) }), { amount: 2 })
    expect(fallback?.code).toBe('DATA001')
  })

  it('accepts a loose object and leaves the payload for evaluation', () => {
    const schema = z.looseObject({ name: z.string() })
    const original = { name: 'Ada', extra: true }
    expect(checkFixture(schema, original)).toBeNull()
    expect(original).toEqual({ name: 'Ada', extra: true })
  })
})

describe('forced locale', () => {
  it('changes a copy and leaves the fixture untouched', () => {
    const original = { orders: [{ clientPreferencesData: { locale: 'en-US' }, orderId: 'KEEP' }] }
    const forced = withForcedLocale(original, 'orders.0.clientPreferencesData.locale', 'pt-BR')
    expect(forced.ok).toBe(true)
    if (!forced.ok) return
    expect(forced.data).toEqual({ orders: [{ clientPreferencesData: { locale: 'pt-BR' }, orderId: 'KEEP' }] })
    expect(original.orders[0]?.clientPreferencesData.locale).toBe('en-US')
  })
})
