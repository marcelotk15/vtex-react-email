import type { ReactNode } from 'react'

import { pixelBasedPreset, Text } from '@react-email/components'
import { checkCatalogs, evaluateArtifact, mintToken, TemplateFailure } from '@vtex-email/core'
import { p0Profile } from '@vtex-email/vtex'
import { describe, expect, it } from 'vitest'

import { Email } from './adapter/email'
import { compileEmail, type CompileEmailInput } from './compile/compile-email'
import { Each, expr, If, Vtex } from './dsl/vtex'

const catalogs = {
  'pt-BR': { note: 'vtx-logo' },
  'en-US': { note: 'vtx-logo' },
}

function input(component: () => ReactNode): CompileEmailInput {
  return {
    email: {
      id: 'closure',
      event: 'closure',
      template: component,
    },
    locale: 'pt-BR',
    catalog: catalogs['pt-BR'] ?? {},
    profile: p0Profile,
    tailwind: { presets: [pixelBasedPreset] },
  }
}

function resolvedHtml(source: string, data: unknown): string {
  return evaluateArtifact({ source, data, profile: p0Profile, simulator: p0Profile })
}

function ImageInEach() {
  return (
    <Email>
      <Each path="items">
        <Text>
          <Vtex.Img alt={expr.path('name')} height={96} src={expr.path('imageUrl')} width={96} />
        </Text>
      </Each>
    </Email>
  )
}

function ImageInTrueBranch() {
  return (
    <Email>
      <If fallback={<Text>no image</Text>} path="show">
        <Text>
          <Vtex.Img alt="photo" height={96} src={expr.path('imageUrl')} width={96} />
        </Text>
      </If>
    </Email>
  )
}

function OrderId() {
  return (
    <Email>
      <Text>
        <Vtex.Value path="orderId" />
      </Text>
    </Email>
  )
}

function OrderUrl() {
  return (
    <Email>
      <Text>
        <Vtex.Value path="orderUrl" />
      </Text>
    </Email>
  )
}

function TwoRoots() {
  return (
    <Email>
      <Each path="items">
        <Text>one</Text>
        <Text>two</Text>
      </Each>
    </Email>
  )
}

function FragmentRoot() {
  return (
    <Email>
      <Each path="items">
        <>
          <Text>one</Text>
        </>
      </Each>
    </Email>
  )
}

function headOf(html: string): string {
  const start = html.toLowerCase().indexOf('<head')
  const end = html.toLowerCase().indexOf('</head>')
  return html.slice(start, end)
}

describe('P0 closure', () => {
  it('resolves two images from each without a preload and without imageUrl at the root', async () => {
    const compiled = await compileEmail(input(ImageInEach))
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const artifact = compiled.artifacts[0]?.content ?? ''
    expect(artifact.includes('rel="preload"')).toBe(false)
    expect(artifact.includes('{{#each items}}')).toBe(true)
    const resolved = resolvedHtml(artifact, {
      locale: 'en-US',
      items: [
        { name: 'Shirt', imageUrl: 'https://cdn.example/shirt.png' },
        { name: 'Sock', imageUrl: 'https://cdn.example/sock.png' },
      ],
    })
    expect(resolved).toContain('src="https://cdn.example/shirt.png"')
    expect(resolved).toContain('src="https://cdn.example/sock.png"')
    expect(resolved).toContain('alt="Shirt"')
    expect(resolved).toContain('height="96"')
    expect(resolved).toContain('width="96"')
    expect(resolved.includes('rel="preload"')).toBe(false)
    const head = headOf(resolved)
    expect(head.includes('shirt.png')).toBe(false)
    expect(head.includes('sock.png')).toBe(false)
  })

  it('does not leave the image of a false branch in head', async () => {
    const compiled = await compileEmail(input(ImageInTrueBranch))
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const resolved = resolvedHtml(compiled.artifacts[0]?.content ?? '', {
      locale: 'en-US',
      show: false,
      imageUrl: 'https://cdn.example/hidden.png',
    })
    expect(resolved.includes('hidden.png')).toBe(false)
    expect(resolved.includes('rel="preload"')).toBe(false)
    expect(resolved).toContain('no image')
  })

  it('does not swap paths between parallel compilations', async () => {
    const [orderId, orderUrl] = await Promise.all([compileEmail(input(OrderId)), compileEmail(input(OrderUrl))])
    expect(orderId.ok && orderUrl.ok).toBe(true)
    if (!orderId.ok || !orderUrl.ok) return
    expect(orderId.artifacts[0]?.content).toContain('{{orderId}}')
    expect(orderId.artifacts[0]?.content.includes('{{orderUrl}}')).toBe(false)
    expect(orderUrl.artifacts[0]?.content).toContain('{{orderUrl}}')
    expect(orderUrl.artifacts[0]?.content.includes('{{orderId}}')).toBe(false)
  })

  it('accepts a fragment and multiple children inside a stamped block region', async () => {
    for (const component of [TwoRoots, FragmentRoot]) {
      const compiled = await compileEmail(input(component))
      expect(compiled).toMatchObject({ ok: true })
      if (!compiled.ok) continue
      const html = compiled.artifacts[0]?.content ?? ''
      expect(html).toContain('{{#each items}}')
      expect(html.includes('data-anchor')).toBe(false)
      expect(html.includes('vtx-anchor')).toBe(false)
    }
  })

  it('rejects DSL use outside a compilation session with DSL002', () => {
    expect(() => Each({ path: 'items', children: <Text>x</Text> })).toThrow(/DSL002|compilation/i)
  })

  it('rejects two html tags in the resolved string with HTML001', () => {
    const duplicated = '<!DOCTYPE html><html><head></head><body></body></html>'.repeat(2)
    expect(() => resolvedHtml(duplicated, {})).toThrow(TemplateFailure)
    let thrown: unknown
    try {
      resolvedHtml(duplicated, {})
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(TemplateFailure)
    if (!(thrown instanceof TemplateFailure)) return
    expect(thrown.diagnostics[0]?.code).toBe('HTML001')
  })

  it('accepts vtx in the catalog and rejects a complete token', () => {
    expect(checkCatalogs(['pt-BR', 'en-US'], catalogs)).toEqual([])
    const leaked = mintToken({ kind: 'text', index: 0, path: 'name', detail: 'value' })
    const rejected = checkCatalogs(['pt-BR', 'en-US'], {
      'pt-BR': { note: leaked },
      'en-US': { note: leaked },
    })
    expect(rejected[0]?.code).toBe('I18N001')
  })
})
