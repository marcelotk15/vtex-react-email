import { describe, expect, it } from 'vitest'

import { checkCatalogs } from './catalog'

describe('catalog placeholders', () => {
  it('requires the same placeholders and rejects a missing key', () => {
    const missing = checkCatalogs(['pt-BR', 'en-US'], {
      'pt-BR': { hello: 'Olá, {name}' },
      'en-US': { hello: 'Hello' },
    })
    expect(missing.some((item) => item.code === 'I18N001' && item.locale === 'en-US')).toBe(true)

    const absent = checkCatalogs(['pt-BR', 'en-US'], {
      'pt-BR': { hello: 'Olá' },
      'en-US': {},
    })
    expect(absent.some((item) => item.code === 'I18N001')).toBe(true)
  })
})
