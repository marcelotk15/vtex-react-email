import { describe, expect, it } from 'vitest'

import { localeOptions, localeValueToSelection, selectionToLocaleValue } from './locale-options'

describe('locale selection', () => {
  it('offers runtime and one forced entry per locale', () => {
    expect(localeOptions(['pt-BR', 'en-US']).map((item) => item.value)).toEqual([
      'runtime',
      'forced:pt-BR',
      'forced:en-US',
    ])
  })

  it('maps the server selection to a single control and back', () => {
    expect(selectionToLocaleValue({ mode: 'runtime', forcedLocale: null })).toBe('runtime')
    expect(selectionToLocaleValue({ mode: 'forced', forcedLocale: 'pt-BR' })).toBe('forced:pt-BR')
    expect(localeValueToSelection('runtime')).toEqual({ mode: 'runtime', forcedLocale: null })
    expect(localeValueToSelection('forced:en-US')).toEqual({ mode: 'forced', forcedLocale: 'en-US' })
    expect(localeValueToSelection('forced:')).toEqual({ mode: 'runtime', forcedLocale: null })
  })
})
