import { renderTemplate } from '@vtex-email/core'
import { describe, expect, it } from 'vitest'

import { p0Profile } from './index'

describe('isolated runtime', () => {
  it('formats 20000 as 200,00 and replaces one occurrence', () => {
    const currency = p0Profile.helpers.find((helper) => helper.name === 'formatCurrency')
    const replace = p0Profile.helpers.find((helper) => helper.name === 'replace')
    expect(currency?.kind).toBe('inline')
    expect(replace?.kind).toBe('inline')
    if (currency?.kind !== 'inline' || replace?.kind !== 'inline') return
    expect(currency.apply(20000)).toBe('200,00')
    expect(replace.apply('8bd', 'bd', ' business days')).toBe('8 business days')
  })

  it('does not evaluate again a value that looks like Handlebars', () => {
    const html = renderTemplate('<p>{{name}}</p>', { name: '{{doNotRun}}' }, p0Profile)
    expect(html).toContain('{{doNotRun}}')
    expect(html.includes('SENTINEL_RAN')).toBe(false)
  })

  it('rejects a missing helper and does not share the registry across instances', () => {
    expect(() => renderTemplate('{{nope value}}', { value: 1 }, p0Profile)).toThrow(/helper/i)
    const first = renderTemplate('{{formatCurrency price}}', { price: 20000 }, p0Profile)
    expect(first).toBe('200,00')
    expect(() => renderTemplate('{{localOnly price}}', { price: 1 }, p0Profile)).toThrow(/helper/i)
  })

  it('simulates ifCond, hasSubStr, group, and formatDate', () => {
    const html = renderTemplate(
      '{{#ifCond name "===" "Destinatario"}}yes{{else}}no{{/ifCond}}|{{#hasSubStr categoriesIds "/9293/"}}ticket{{else}}plain{{/hasSubStr}}|{{#group items by="packageId"}}{{#each items}}{{name}}-{{/each}}{{/group}}|{{formatDate dueDate}}',
      {
        name: 'Destinatario',
        categoriesIds: '/1/9293/2/',
        dueDate: '2026-03-15T12:00:00.000Z',
        items: [
          { name: 'A', packageId: 'p1' },
          { name: 'B', packageId: 'p1' },
          { name: 'C', packageId: 'p2' },
        ],
      },
      p0Profile,
    )
    expect(html).toContain('yes')
    expect(html).toContain('ticket')
    expect(html).toContain('A-B-')
    expect(html).toContain('C-')
    expect(html).toMatch(/\d{2}\/\d{2}\/2026/)
  })

  it('escapes special characters exactly once', () => {
    const html = renderTemplate(
      '<p>{{name}}</p><a href="{{url}}">x</a>',
      {
        name: 'Ana & "Lia" <João>',
        url: 'https://example.com/a?x=1&y=2',
      },
      p0Profile,
    )
    expect(html).toContain('Ana &amp; &quot;Lia&quot; &lt;João&gt;')
    expect(html).toContain('href="https://example.com/a?x&#x3D;1&amp;y&#x3D;2"')
    expect(html.includes('&amp;amp;')).toBe(false)
  })
})
