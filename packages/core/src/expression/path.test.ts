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
    expect(parsePath('../orderId', false).ok).toBe(false)
  })

  it('accepts Handlebars segment literals and emits brackets only when needed', () => {
    expect(parsePath('content.[Tipo Documento]', true)).toMatchObject({
      ok: true,
      segments: ['content', 'Tipo Documento'],
      emitted: 'content.[Tipo Documento]',
    })
    expect(parsePath('../content.[Primer Nombre]', true)).toMatchObject({
      ok: true,
      emitted: '../content.[Primer Nombre]',
    })
    expect(parsePath('[Sede]', true)).toMatchObject({ ok: true, emitted: 'Sede' })
    expect(parsePath('items.[0].name', true)).toMatchObject({ ok: true, emitted: 'items.0.name' })
    expect(parsePath('a.[b-c].d', true)).toMatchObject({ ok: true, emitted: 'a.[b-c].d' })
  })

  it.each([
    'content.[Tipo',
    'content.[]',
    'content.[ padded ]',
    'content.[a]b',
    'content[a]',
    'content.[a}}]',
    'content.[..]',
    'content.[__proto__]',
    'content.[this]',
    'content.[a].',
  ])('rejects the malformed or unsafe segment literal %s', (input) => {
    expect(parsePath(input, true).ok).toBe(false)
  })

  it('serializes quotes and backslashes in a stable way', () => {
    expect(emitLiteral('a"b\\c')).toBe('"a\\"b\\\\c"')
    expect(emitLiteral('a"b\\c')).toBe('"a\\"b\\\\c"')
    expect(emitLiteral(null)).toBe('null')
    expect(emitLiteral(true)).toBe('true')
  })
})
