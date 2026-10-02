import { describe, expect, it } from 'vitest'

import { withForcedLocale } from './locale-path'

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
