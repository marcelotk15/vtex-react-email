import { describe, expect, it } from 'vitest'

import { emitLiteral } from '../hbs/source'
import { parsePath } from './path'

describe('path and literal emission', () => {
  it('emits a relative path, an index, and a parent reference', () => {
    expect(parsePath('orders.0.clientPreferencesData.locale', true)).toMatchObject({
      ok: true,
      emitted: 'orders.0.clientPreferencesData.locale',
    })
    expect(parsePath('../orderId', true)).toMatchObject({ ok: true, emitted: '../orderId' })
    expect(parsePath('../../orderId', true)).toMatchObject({ ok: true, emitted: '../../orderId' })
  })

  it('rejects prototype and segments outside the subset', () => {
    expect(parsePath('__proto__.x', true).ok).toBe(false)
    expect(parsePath('prototype', true).ok).toBe(false)
    expect(parsePath('constructor', true).ok).toBe(false)
    expect(parsePath('@index', true)).toMatchObject({ ok: true, emitted: '@index' })
    expect(parsePath('@root', true).ok).toBe(false)
    expect(parsePath('this', true).ok).toBe(false)
    expect(parsePath('items.[0].name', true).ok).toBe(false)
    expect(parsePath('../orderId', false).ok).toBe(false)
  })

  it('serializes quotes and backslashes in a stable way', () => {
    expect(emitLiteral('a"b\\c')).toBe('"a\\"b\\\\c"')
    expect(emitLiteral('a"b\\c')).toBe('"a\\"b\\\\c"')
    expect(emitLiteral(null)).toBe('null')
    expect(emitLiteral(true)).toBe('true')
  })
})
