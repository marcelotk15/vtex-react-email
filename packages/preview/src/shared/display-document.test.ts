import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { displayDocument } from './display-document'

const meta = '<meta http-equiv="Content-Security-Policy" content="img-src \'none\'">'

describe('remote image display', () => {
  it('keeps the resolved document until the view asks to block images', () => {
    const html = [
      '<html><head><title>Pedido</title></head><body>',
      '<img src="https://cdn.example/a.png" srcset="https://cdn.example/a.png 1x" alt="Camisa">',
      '<p style="background-image:url(https://cdn.example/b.png)"></p>',
      '</body></html>',
    ].join('')
    expect(displayDocument(html, false)).toBe(html)
    const blocked = displayDocument(html, true)
    expect(blocked).toContain(`<head>${meta}`)
    expect(blocked).toContain('src="https://cdn.example/a.png"')
    expect(blocked).toContain('srcset="https://cdn.example/a.png 1x"')
    expect(blocked).toContain('url(https://cdn.example/b.png)')
    expect(displayDocument(blocked, true)).toBe(blocked)
    expect(displayDocument(html, false)).toBe(html)
    expect(html.includes('Content-Security-Policy')).toBe(false)
  })

  it('adds a head when the resolved fragment has none', () => {
    const html = '<p><img src="https://cdn.example/a.png" alt="Meia"></p>'
    expect(displayDocument(html, true).startsWith(`<head>${meta}</head>`)).toBe(true)
    expect(displayDocument(html, true)).toContain('src="https://cdn.example/a.png"')
  })

  it('uses the same function and the view warning in the workbench', () => {
    const frame = readFileSync(new URL('../ui/canvas/email-frame.tsx', import.meta.url), 'utf8')
    const canvas = readFileSync(new URL('../ui/canvas/canvas.tsx', import.meta.url), 'utf8')
    const properties = readFileSync(new URL('../ui/properties/properties-panel.tsx', import.meta.url), 'utf8')
    expect(frame).toContain('displayDocument(html, blocked)')
    expect(frame).toContain("setAttribute('sandbox', '')")
    expect(canvas).toContain('Remote images are blocked in this view. The template was not changed.')
    expect(properties).toContain('Block remote images')
  })
})
