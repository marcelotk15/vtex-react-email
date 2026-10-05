import { pixelBasedPreset, Section } from '@react-email/components'
import { p0Profile } from '@vtex-email/vtex'
import { describe, expect, it } from 'vitest'

import { compileEmail, Email, expr, Vtex } from './index'

describe('logo attrs', () => {
  it('emits composite', async () => {
    function LogoOnly() {
      return (
        <Email>
          <Section>
            <Vtex.Link href={['http://', expr.path('_accountInfo.HostName'), '.com.br']}>store</Vtex.Link>
            <Vtex.Img
              alt={expr.path('_accountInfo.TradingName')}
              height={80}
              src={['http://x/', expr.path('_accountInfo.Id'), '/y']}
              width={160}
            />
          </Section>
        </Email>
      )
    }
    const compiled = await compileEmail({
      email: { id: 'logo', event: 'logo', template: LogoOnly },
      locale: 'pt-BR',
      catalog: {},
      profile: p0Profile,
      tailwind: { presets: [pixelBasedPreset] },
    })
    if (!compiled.ok) {
      console.log(compiled.diagnostics)
    }
    expect(compiled.ok).toBe(true)
    if (compiled.ok) console.log(compiled.artifacts[0]?.content)
  })
})
