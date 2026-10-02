import { describe, expect, it } from 'vitest'

import { restoreHandlebars } from './restore'
import { mintToken, type Marker } from './tokens'

function token(detail: string): string {
  return mintToken({ kind: 'probe', index: 0, path: detail, detail })
}

describe('structural restoration', () => {
  it('replaces an element and removes the marker', () => {
    const id = token('value')
    const markers = new Map<string, Marker>([[id, { kind: 'text', replacement: '{{orderId}}' }]])
    const html = `<p><span data-anchor="${id}">\u200b</span></p>`
    const restored = restoreHandlebars(html, markers)
    expect(restored).toMatchObject({ ok: true })
    if (!restored.ok) return
    expect(restored.html).toBe('<p>{{orderId}}</p>')
    expect(restored.html.includes('vtx')).toBe(false)
  })

  it('replaces an attribute value without decoding the document', () => {
    const id = token('href')
    const markers = new Map<string, Marker>([[id, { kind: 'attr', attribute: 'href', replacement: '{{orderUrl}}' }]])
    const restored = restoreHandlebars(`<a href="${id}">view</a>`, markers)
    expect(restored).toMatchObject({ ok: true })
    if (!restored.ok) return
    expect(restored.html).toBe('<a href="{{orderUrl}}">view</a>')
  })

  it('removes the copied preload and keeps the original image', () => {
    const id = token('src')
    const markers = new Map<string, Marker>([[id, { kind: 'attr', attribute: 'src', replacement: '{{imageUrl}}' }]])
    const html = `<head><link rel="preload" as="image" href="${id}"/></head><img alt="photo" height="96" src="${id}" width="96"/>`
    const restored = restoreHandlebars(html, markers)
    expect(restored).toMatchObject({ ok: true })
    if (!restored.ok) return
    expect(restored.html).toBe('<head></head><img alt="photo" height="96" src="{{imageUrl}}" width="96"/>')
  })

  it('rejects a token copy outside the image preload', () => {
    const id = token('src')
    const markers = new Map<string, Marker>([[id, { kind: 'attr', attribute: 'src', replacement: '{{imageUrl}}' }]])
    const restored = restoreHandlebars(`<img src="${id}"/><div title="${id}"></div>`, markers)
    expect(restored.ok).toBe(false)
    if (restored.ok) return
    expect(restored.diagnostics[0]?.code).toBe('TOK001')
  })

  it('inserts open, alternative, and close at the element boundaries', () => {
    const open = token('open')
    const alternative = token('else')
    const markers = new Map<string, Marker>([
      [open, { kind: 'open', open: '{{#if shippingData.address}}', close: '{{/if}}', elseId: alternative }],
      [alternative, { kind: 'else', openId: open }],
    ])
    const html = `<p data-anchor="${open}">street</p><p data-anchor="${alternative}">pickup</p>`
    const restored = restoreHandlebars(html, markers)
    expect(restored).toMatchObject({ ok: true })
    if (!restored.ok) return
    expect(restored.html).toBe('{{#if shippingData.address}}<p>street</p>{{else}}<p>pickup</p>{{/if}}')
  })

  it('keeps static neighbors outside sibling and nested regions', () => {
    const outer = token('outer')
    const inner = token('inner')
    const sibling = token('sibling')
    const markers = new Map<string, Marker>([
      [outer, { kind: 'open', open: '{{#each orders}}', close: '{{/each}}', elseId: null }],
      [inner, { kind: 'open', open: '{{#each items}}', close: '{{/each}}', elseId: null }],
      [sibling, { kind: 'open', open: '{{#if show}}', close: '{{/if}}', elseId: null }],
    ])
    const html = [
      '<p>before</p>',
      `<div data-anchor="${outer}">static<p data-anchor="${inner}">item</p>end</div>`,
      '<p>middle</p>',
      `<p data-anchor="${sibling}">two</p>`,
      '<p>after</p>',
    ].join('')
    const restored = restoreHandlebars(html, markers)
    expect(restored).toMatchObject({ ok: true })
    if (!restored.ok) return
    expect(restored.html).toBe(
      [
        '<p>before</p>',
        '{{#each orders}}<div>static{{#each items}}<p>item</p>{{/each}}end</div>{{/each}}',
        '<p>middle</p>',
        '{{#if show}}<p>two</p>{{/if}}',
        '<p>after</p>',
      ].join(''),
    )
  })

  it('fails when the parser closes the anchor before the written end', () => {
    const id = token('implicit')
    const markers = new Map<string, Marker>([
      [id, { kind: 'open', open: '{{#if show}}', close: '{{/if}}', elseId: null }],
    ])
    const restored = restoreHandlebars(`<p data-anchor="${id}">text<div>inner</div></p>`, markers)
    expect(restored.ok).toBe(false)
    if (restored.ok) return
    expect(restored.diagnostics[0]?.code).toBe('TOK001')
    expect(restored.diagnostics[0]?.message.includes('{{#if show}}')).toBe(false)
  })

  it('accepts a loose vtx, data-vtx, and vtx-logo without treating them as markers', () => {
    const id = token('plain')
    const markers = new Map<string, Marker>([[id, { kind: 'text', replacement: '{{name}}' }]])
    const html = `<p data-vtx="legitimate">word vtx</p><span data-anchor="${id}">\u200b</span><p>vtx-logo</p>`
    const restored = restoreHandlebars(html, markers)
    expect(restored).toMatchObject({ ok: true })
    if (!restored.ok) return
    expect(restored.html).toBe('<p data-vtx="legitimate">word vtx</p>{{name}}<p>vtx-logo</p>')
  })

  it('fails without a partial marker when the token is truncated, split, duplicated, escaped, or glued', () => {
    const id = token('one')
    const markers = new Map<string, Marker>([[id, { kind: 'text', replacement: '{{name}}' }]])
    const cases = [
      `vtx${id.slice(3, 8)}`,
      `vtx<b>${id.slice(3)}</b>`,
      `<span data-anchor="${id}"></span><span data-anchor="${id}"></span>`,
      `<span data-anchor="${id.replace('v', '&#118;')}"></span>`,
      `<span data-anchor="${id}extra"></span>`,
      `<p>${token('unknown')}</p>`,
    ]

    for (const html of cases) {
      const restored = restoreHandlebars(html, markers)
      expect(restored.ok).toBe(false)
      if (restored.ok) continue
      expect(restored.diagnostics[0]?.code).toBe('TOK001')
      expect(restored.diagnostics.some((item) => item.message.includes('{{name}}'))).toBe(false)
    }
  })
})
