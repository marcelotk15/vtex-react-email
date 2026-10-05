import {
  checkFixture,
  commitArtifacts,
  evaluateArtifact,
  mergeLocaleDocuments,
  normalizeOutput,
  opaqueTokenIssue,
  restoreHandlebars,
} from '@vtex-email/core'
import { p0Profile } from '@vtex-email/vtex'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { OrderConfirmed } from '../golden-fixtures/emails/order-confirmed.email'
import { OrderConfirmedSchema } from '../golden-fixtures/schema'
import { goldenTailwind } from '../golden-fixtures/tailwind'
import { compileEmail, type CompileEmailResult } from './compile/compile-email'

interface FixtureFile {
  sellerNote?: string
  orders: Array<{
    orderId: string
    clientProfileData: { firstName?: string }
    clientPreferencesData?: { locale?: string }
    shippingData?: { address?: { street: string } }
    items: Array<{ name: string; sellingPrice: number }>
  }>
}

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../golden-fixtures')

function countOf(haystack: string, needle: string): number {
  let count = 0
  let index = 0
  while (index < haystack.length) {
    const found = haystack.indexOf(needle, index)
    if (found === -1) break
    count += 1
    index = found + needle.length
  }
  return count
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T
}

function compileLocale(locale: string, catalog: Readonly<Record<string, string>>): Promise<CompileEmailResult> {
  return compileEmail({
    email: {
      id: 'order-confirmed',
      event: 'order-confirmed',
      template: OrderConfirmed,
    },
    locale,
    catalog,
    profile: p0Profile,
    tailwind: goldenTailwind,
    file: 'packages/react/golden-fixtures/emails/order-confirmed.email.tsx',
  })
}

async function compileMerged(
  catalogs: Record<string, Readonly<Record<string, string>>>,
): Promise<
  | { ok: true; content: string; sha256: string; manifest: Extract<CompileEmailResult, { ok: true }>['manifest'] }
  | { ok: false; diagnostics: Extract<CompileEmailResult, { ok: false }>['diagnostics'] }
> {
  const portuguese = catalogs['pt-BR']
  const english = catalogs['en-US']
  if (!portuguese || !english) {
    return { ok: false, diagnostics: [] }
  }
  const [pt, en] = await Promise.all([compileLocale('pt-BR', portuguese), compileLocale('en-US', english)])
  if (!pt.ok) return pt
  if (!en.ok) return en
  const ptHtml = pt.artifacts[0]?.content
  const enHtml = en.artifacts[0]?.content
  if (!ptHtml || !enHtml) return { ok: false, diagnostics: pt.diagnostics }
  const content = normalizeOutput(
    mergeLocaleDocuments({
      localePath: 'orders.0.clientPreferencesData.locale',
      defaultLocale: 'pt-BR',
      documents: [
        { locale: 'pt-BR', html: ptHtml },
        { locale: 'en-US', html: enHtml },
      ],
    }),
  )
  return { ok: true, content, sha256: pt.artifacts[0]?.sha256 ?? '', manifest: pt.manifest }
}

function evaluate(source: string, data: unknown): string {
  return evaluateArtifact({ source, data, profile: p0Profile, simulator: p0Profile })
}

describe('golden path order-confirmed', () => {
  it('compiles, writes, and evaluates delivery and pickup on the same artifact', async () => {
    const catalogs = {
      'pt-BR': await readJson<Record<string, string>>(path.join(fixturesRoot, 'locales/pt-BR.json')),
      'en-US': await readJson<Record<string, string>>(path.join(fixturesRoot, 'locales/en-US.json')),
    }
    const deliveryFile = await readJson<{ data: FixtureFile }>(
      path.join(fixturesRoot, 'fixtures/order-confirmed/delivery.json'),
    )
    const pickupFile = await readJson<{ data: FixtureFile }>(
      path.join(fixturesRoot, 'fixtures/order-confirmed/pickup.json'),
    )
    const delivery = deliveryFile.data
    const pickup = pickupFile.data

    expect(checkFixture(OrderConfirmedSchema, delivery)).toBeNull()
    expect(checkFixture(OrderConfirmedSchema, pickup)).toBeNull()

    const first = await compileMerged(catalogs)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const changed = structuredClone(delivery)
    const firstOrder = changed.orders[0]
    expect(firstOrder).toBeDefined()
    if (!firstOrder) return
    firstOrder.orderId = 'CHANGED'
    expect(first.content.includes('\r')).toBe(false)
    expect(first.content.includes('\n')).toBe(true)
    expect(opaqueTokenIssue(first.content)).toBeNull()
    expect(first.content.includes('rel="preload"')).toBe(false)
    expect(first.content.includes('<script')).toBe(false)
    expect(first.content.includes('ORD-A')).toBe(false)
    expect(first.content.includes('Ana &')).toBe(false)
    expect(first.content.includes('Rua São João')).toBe(false)
    expect(first.content.includes('20000')).toBe(false)
    expect(first.content.includes('200,00')).toBe(false)
    expect(first.content).toContain('{{#each orders}}')
    expect(first.content).toContain('{{#each items}}')
    expect(first.content).toContain('{{#if shippingData.address}}')
    expect(first.content).toContain('{{else}}')
    expect(first.content).toContain('{{../orderId}}')
    expect(first.content).toContain('{{formatCurrency sellingPrice}}')
    expect(first.content).toContain('{{replace shippingEstimate "bd" " business days"}}')
    expect(first.content).toContain('@media')
    expect(first.content).toContain('sm_p-4')
    expect(first.content).toContain('<!--[if mso]>')
    expect(countOf(first.content, '<!DOCTYPE')).toBe(2)
    expect(first.manifest.homologation).toBe('experimental')
    expect(first.content).toContain('{{#eq ')

    const outputDir = await mkdtemp(path.join(tmpdir(), 'vtex email '))
    await commitArtifacts(outputDir, [{ name: 'order-confirmed.html', content: first.content }])
    const written = await readFile(path.join(outputDir, 'order-confirmed.html'), 'utf8')
    expect(written).toBe(first.content)

    const english = evaluate(written, delivery)
    const portuguese = evaluate(written, pickup)
    const changedPreview = evaluate(written, changed)
    expect(english).not.toBe(portuguese)
    expect(changedPreview).toContain('CHANGED')
    expect(english.includes('Order confirmed') && english.includes('Hello')).toBe(true)
    expect(english.includes('Pedido confirmado')).toBe(false)
    expect(portuguese.includes('Pedido confirmado') && portuguese.includes('Retirada na loja')).toBe(true)
    expect(portuguese.includes('Rua São João')).toBe(false)
    expect(english.includes('Order<!-- --> ORD-A') && english.includes('Order<!-- --> ORD-B')).toBe(true)
    expect(countOf(english, '>ORD-A</p>')).toBe(2)
    expect(countOf(english, '>ORD-B</p>')).toBe(1)
    expect(english).toContain('Ana &amp; &quot;Lia&quot; &lt;João&gt;')
    expect(english).toContain('Camisa &amp; &quot;Azul&quot;')
    expect(english).toContain('src="https://example.com/images/camisa.png?x&#x3D;1&amp;y&#x3D;2"')
    expect(english).toContain('src="https://example.com/images/meia.png"')
    expect(english).toContain('src="https://example.com/images/bone.png"')
    expect(english.includes('rel="preload"')).toBe(false)
    const englishHead = english.slice(english.toLowerCase().indexOf('<head'), english.toLowerCase().indexOf('</head>'))
    expect(englishHead.includes('camisa.png') || englishHead.includes('meia.png')).toBe(false)
    expect(english.includes('João') && english.includes('São')).toBe(true)
    expect(english.includes('200,00') && english.includes('0,00')).toBe(true)
    expect(english.includes('8 business days') && english.includes('3 business days')).toBe(true)
    expect(english.includes('Rua São João 10') && english.includes('Avenida Central')).toBe(true)
    expect(countOf(english, '<!DOCTYPE')).toBe(1)
    expect(countOf(portuguese, '<html')).toBe(1)
    expect(countOf(portuguese, '<head')).toBe(1)
    expect(countOf(portuguese, '<body')).toBe(1)

    const unknown = structuredClone(delivery)
    const unknownOrder = unknown.orders[0]
    expect(unknownOrder?.clientPreferencesData).toBeDefined()
    if (!unknownOrder?.clientPreferencesData) return
    unknownOrder.clientPreferencesData.locale = 'fr-FR'
    const fallback = evaluate(written, unknown)
    expect(fallback.includes('Pedido confirmado') && !fallback.includes('Order confirmed')).toBe(true)

    const emptyDir = await mkdtemp(path.join(tmpdir(), 'vtex-email-'))
    const brokenCatalogs = structuredClone(catalogs)
    delete brokenCatalogs['pt-BR']['order.pickup']
    const missingKey = await compileLocale('pt-BR', brokenCatalogs['pt-BR'])
    expect(missingKey.ok).toBe(false)
    if (missingKey.ok) return
    expect(missingKey.diagnostics.some((item) => item.code === 'I18N001')).toBe(true)
    expect(await readdir(emptyDir)).toEqual([])

    const corrupted = restoreHandlebars('vtxtruncated', new Map())
    expect(corrupted.ok).toBe(false)
    if (corrupted.ok) return
    expect(corrupted.diagnostics[0]?.code).toBe('TOK001')
    expect(await readdir(emptyDir)).toEqual([])

    const catalogsA = structuredClone(catalogs)
    const catalogsB = structuredClone(catalogs)
    catalogsA['pt-BR']['order.confirmed.title'] = 'TITLE-AAA'
    catalogsA['en-US']['order.confirmed.title'] = 'TITLE-AAA'
    catalogsB['pt-BR']['order.confirmed.title'] = 'TITLE-BBB'
    catalogsB['en-US']['order.confirmed.title'] = 'TITLE-BBB'
    const [parallelA, parallelB] = await Promise.all([compileMerged(catalogsA), compileMerged(catalogsB)])
    expect(parallelA.ok && parallelB.ok).toBe(true)
    if (!parallelA.ok || !parallelB.ok) return
    expect(parallelA.content.includes('TITLE-AAA') && !parallelA.content.includes('TITLE-BBB')).toBe(true)
    expect(parallelB.content.includes('TITLE-BBB') && !parallelB.content.includes('TITLE-AAA')).toBe(true)
    expect(opaqueTokenIssue(parallelA.content)).toBeNull()
    expect(opaqueTokenIssue(parallelB.content)).toBeNull()
  }, 30_000)
})
