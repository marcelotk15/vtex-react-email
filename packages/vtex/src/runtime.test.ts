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

  it('simulates formatTime, formatDateTime, math, with, and richShippingData', () => {
    const html = renderTemplate(
      '{{formatTime when}}|{{formatDateTime when}}|{{math a "+" b}}|{{#with address}}{{street}}{{/with}}|{{#richShippingData shippingData}}{{#group logisticsInfo by="packageId"}}{{value}};{{/group}}{{/richShippingData}}',
      {
        when: '2026-03-15T14:05:09.000',
        a: 2,
        b: 3,
        address: { street: 'Rua A' },
        shippingData: {
          logisticsInfo: [
            {
              selectedSla: 'normal',
              slas: [{ id: 'normal', shippingEstimate: '3d', shippingEstimateDate: '2026-03-18' }],
            },
            {
              selectedSla: 'express',
              slas: [{ id: 'express', shippingEstimate: '1d', shippingEstimateDate: '2026-03-16' }],
            },
          ],
        },
      },
      p0Profile,
    )
    expect(html).toContain('14:05')
    expect(html).toContain('15/03/2026 14:05:09')
    expect(html).toContain('5')
    expect(html).toContain('Rua A')
    expect(html.indexOf('express')).toBeLessThan(html.indexOf('normal'))
  })

  it('rejects invalid dates and non-finite math', () => {
    expect(() => renderTemplate('{{formatDate bad}}', { bad: 'not-a-date' }, p0Profile)).toThrow(/formatDate/)
    expect(() => renderTemplate('{{math a "/" b}}', { a: 1, b: 0 }, p0Profile)).toThrow(/math/)
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
