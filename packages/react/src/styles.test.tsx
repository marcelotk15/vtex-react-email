import { pixelBasedPreset, Text } from '@react-email/components'
import { describe, expect, it } from 'vitest'

import { p0Profile } from '../../vtex/src/index'
import { compileEmail } from './compile'
import { Email } from './email'
import { diagnoseStyles } from './styles'

describe('style diagnostics', () => {
  it('warns about flex and keeps a sanitized media class', async () => {
    function View() {
      return (
        <Email className="flex sm:p-4">
          <Text>Hi</Text>
        </Email>
      )
    }
    const compiled = await compileEmail({
      email: { id: 'styles', event: 'styles', template: View },
      locale: 'pt-BR',
      catalog: {},
      profile: p0Profile,
      tailwind: { presets: [pixelBasedPreset] },
    })
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const html = compiled.artifacts[0]?.content ?? ''
    const issues = diagnoseStyles(html)
    expect(issues.some((item) => item.code === 'CSS001' && item.message.includes('display:flex'))).toBe(true)
    expect(issues.some((item) => item.message.includes('sm_p-4'))).toBe(false)
    expect(issues.every((item) => item.message.includes('does not establish compatibility'))).toBe(true)
    expect(html.includes('sm_p-4')).toBe(true)
  })

  it('reports a class the adapter left behind', () => {
    const html =
      '<html><head><style>.sm_p-4{padding:16px}</style></head><body><p class="sm_p-4"></p><p class="text-red-500"></p></body></html>'
    const issues = diagnoseStyles(html)
    expect(issues.some((item) => item.code === 'CSS002' && item.message.includes('text-red-500'))).toBe(true)
    expect(issues.some((item) => item.message.includes('sm_p-4'))).toBe(false)
  })
})
