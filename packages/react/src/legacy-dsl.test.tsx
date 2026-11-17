import type { ReactNode } from 'react'

import { pixelBasedPreset } from '@react-email/components'
import { evaluateArtifact } from '@vtex-email/core'
import { messageCenterSimulator, p0Profile } from '@vtex-email/vtex'
import { describe, expect, it } from 'vitest'

import { Email } from './adapter/email'
import { compileEmail } from './compile/compile-email'
import { expr, Vtex } from './dsl/vtex'

async function compile(component: () => ReactNode) {
  const result = await compileEmail({
    email: { id: 'legacy', event: 'legacy', template: component },
    locale: 'es-CO',
    catalog: {},
    profile: p0Profile,
    tailwind: { presets: [pixelBasedPreset] },
  })
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return result.artifacts[0]?.content ?? ''
}

function render(source: string, data: unknown) {
  return evaluateArtifact({ source, data, profile: p0Profile, simulator: messageCenterSimulator })
}

describe('DSL for migrated table templates', () => {
  it('emits blocks between table rows', async () => {
    const source = await compile(() => (
      <Email>
        <table>
          <tbody>
            <Vtex.Each path="items">
              <Vtex.IfCond operator="!=" path="name" value="">
                <tr>
                  <td>
                    <Vtex.Value path="name" />
                  </td>
                </tr>
              </Vtex.IfCond>
            </Vtex.Each>
          </tbody>
        </table>
      </Email>
    ))
    expect(source).toContain(
      '<tbody>{{#each items}}{{#ifCond name "!=" ""}}<tr><td>{{name}}</td></tr>{{/ifCond}}{{/each}}</tbody>',
    )
    expect(render(source, { items: [{ name: 'A' }, { name: '' }, { name: 'B' }] })).toContain(
      '<tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody>',
    )
  })

  it('emits segment literals and eval as an empty block with named arguments', async () => {
    const code = 'var parts = "${Agreement}".split("|"); parts[2] + " - $" + parts[1] / 100'
    const source = await compile(() => (
      <Email>
        <p>
          <Vtex.Value path="content.[Tipo Documento]" /> |{' '}
          <Vtex.Eval code={code} vars={{ Agreement: expr.path('content.BusinessAgreement') }} />
        </p>
      </Email>
    ))
    expect(source).toContain('{{content.[Tipo Documento]}}')
    expect(source).toContain(
      '{{#eval "var parts = \\"${Agreement}\\".split(\\"|\\"); parts[2] + \\" - $\\" + parts[1] / 100" Agreement=content.BusinessAgreement}}{{/eval}}',
    )
    const html = render(source, { content: { 'Tipo Documento': 'CC', BusinessAgreement: 'id|300000|Convenio' } })
    expect(html).toMatch(/<p>CC \|(<!-- -->)? Convenio - \$3000<\/p>/)
  })

  it('rejects eval named arguments that are not identifiers', async () => {
    await expect(
      compile(() => (
        <Email>
          <Vtex.Eval code="1" vars={{ 'not valid': expr.path('a') }} />
        </Email>
      )),
    ).rejects.toThrow(/not an identifier/)
  })

  it('writes dynamic attributes on plain elements', async () => {
    const source = await compile(() => (
      <Email>
        <a href={Vtex.attr('href', ['https://example.com/orders/', expr.path('orderId')])} style={{ color: 'red' }}>
          <img alt={Vtex.attr('alt', expr.path('name'))} src={Vtex.attr('src', expr.path('imageUrl'))} />
        </a>
      </Email>
    ))
    expect(source).toContain('href="https://example.com/orders/{{orderId}}"')
    expect(source).toContain('alt="{{name}}"')
    expect(source).toContain('src="{{imageUrl}}"')
  })

  it('controls head content, html attributes, the body wrapper, and the doctype', async () => {
    const source = await compile(() => (
      <Email
        bodyStyle={{ margin: 0 }}
        bodyTable={false}
        doctype={null}
        head={<style>{'@media (max-width: 480px) { a > b { color: red } }'}</style>}
        htmlAttributes={{ 'xmlns:o': 'urn:schemas-microsoft-com:office:office' }}
      >
        <p>hi</p>
      </Email>
    ))
    expect(source.startsWith('<html')).toBe(true)
    expect(source).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"')
    expect(source).toContain('<style>@media (max-width: 480px) { a > b { color: red } }</style>')
    expect(source).toMatch(/<body style="margin:0">/)
    expect(source).not.toContain('role="presentation"')
    expect(render(source, {})).toContain('<p>hi</p>')
  })

  it('keeps the React Email doctype by default', async () => {
    const source = await compile(() => (
      <Email>
        <p>hi</p>
      </Email>
    ))
    expect(source.startsWith('<!DOCTYPE html PUBLIC')).toBe(true)
  })
})
