import {
  assertPinnedNode,
  checkFixture,
  commitArtifacts,
  defineEmail,
  evaluateArtifact,
  mergeLocaleDocuments,
  normalizeOutput,
  opaqueTokenIssue,
  restoreHandlebars,
  type Profile,
} from '@vtex-email/core'
import { compileEmail, type CompileEmailResult } from '@vtex-email/react'
import { p0Profile } from '@vtex-email/vtex'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { OrderConfirmed } from './emails/order-confirmed.email'
import { OrderConfirmedSchema } from './schema'
import { proofTailwind } from './tailwind'

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

export function proofRoot(): string {
  const fromEnv = process.env.VTEX_EMAIL_PROOF_DIR
  if (fromEnv) return fromEnv
  return path.dirname(fileURLToPath(import.meta.url))
}

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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T
}

function compileLocale(locale: string, catalog: Readonly<Record<string, string>>): Promise<CompileEmailResult> {
  return compileEmail({
    email: defineEmail({
      id: 'order-confirmed',
      event: 'order-confirmed',
      template: OrderConfirmed,
      schema: OrderConfirmedSchema,
      fixtures: 'fixtures/order-confirmed/*.json',
      i18n: {
        locales: ['pt-BR', 'en-US'],
        defaultLocale: 'pt-BR',
        localePath: 'orders.0.clientPreferencesData.locale',
        output: 'merged',
      },
    }),
    locale,
    catalog,
    profile: p0Profile,
    tailwind: proofTailwind,
    file: 'proof/emails/order-confirmed.email.tsx',
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

export async function executeProof(): Promise<void> {
  const root = proofRoot()
  assertPinnedNode(path.resolve(root, '../.nvmrc'))
  const catalogs = {
    'pt-BR': await readJson<Record<string, string>>(path.join(root, 'locales/pt-BR.json')),
    'en-US': await readJson<Record<string, string>>(path.join(root, 'locales/en-US.json')),
  }
  const delivery = await readJson<FixtureFile>(path.join(root, 'fixtures/order-confirmed/delivery.json'))
  const pickup = await readJson<FixtureFile>(path.join(root, 'fixtures/order-confirmed/pickup.json'))
  await readJson(path.join(root, 'fixtures/order-confirmed/delivery.meta.json'))
  await readJson(path.join(root, 'fixtures/order-confirmed/pickup.meta.json'))

  assert(checkFixture(OrderConfirmedSchema, delivery) === null, 'The delivery fixture failed the schema.')
  assert(checkFixture(OrderConfirmedSchema, pickup) === null, 'The pickup fixture failed the schema.')

  const first = await compileMerged(catalogs)
  assert(first.ok, `The proof compilation failed: ${JSON.stringify(first)}`)
  if (!first.ok) return
  const changed = structuredClone(delivery)
  const firstOrder = changed.orders[0]
  assert(firstOrder !== undefined, 'The delivery fixture has no order.')
  firstOrder.orderId = 'CHANGED'
  assert(!first.content.includes('\r'), 'The artifact contains CR.')
  assert(first.content.includes('\n'), 'The artifact did not normalize line breaks to LF.')
  assert(opaqueTokenIssue(first.content) === null, 'An internal marker remained in the artifact.')
  assert(!first.content.includes('rel="preload"'), 'An image preload remained in the artifact.')
  assert(!first.content.includes('<script'), 'The artifact contains a script.')
  assert(!first.content.includes('ORD-A'), 'Fixture data remained in the build.')
  assert(!first.content.includes('Ana &'), 'The fixture name remained in the build.')
  assert(!first.content.includes('Rua São João'), 'The fixture address remained in the build.')
  assert(!first.content.includes('20000'), 'The fixture price remained in the build.')
  assert(!first.content.includes('200,00'), 'The helper result was frozen into the build.')
  assert(first.content.includes('{{#each orders}}'), 'The orders loop is missing.')
  assert(first.content.includes('{{#each items}}'), 'The items loop is missing.')
  assert(first.content.includes('{{#if shippingData.address}}'), 'The conditional is missing.')
  assert(first.content.includes('{{else}}'), 'The alternative is missing.')
  assert(first.content.includes('{{../orderId}}'), 'The parent context reference is missing.')
  assert(first.content.includes('{{formatCurrency sellingPrice}}'), 'The currency helper is missing.')
  assert(first.content.includes('{{replace shippingEstimate "bd" " business days"}}'), 'The replace helper is missing.')
  assert(first.content.includes('@media'), 'The media query was removed.')
  assert(first.content.includes('sm_p-4'), 'The sanitized responsive class was removed.')
  assert(first.content.includes('<!--[if mso]>'), 'The button conditional comment was removed.')
  assert(countOf(first.content, '<!DOCTYPE') === 2, 'The merged source does not contain both documents.')
  assert(first.manifest.homologation === 'experimental', 'The proof claimed verification.')
  assert(first.content.includes('{{#eq '), 'The locale essay did not emit eq.')

  const outputDir = path.join(root, 'out', 'with space')
  await commitArtifacts(outputDir, [{ name: 'order-confirmed.html', content: first.content }])
  const written = await readFile(path.join(outputDir, 'order-confirmed.html'), 'utf8')
  assert(written === first.content, 'The written file differs from the compiled artifact.')

  const english = evaluate(written, delivery)
  const portuguese = evaluate(written, pickup)
  const changedPreview = evaluate(written, changed)
  assert(english !== portuguese, 'Different fixtures produced the same preview.')
  assert(changedPreview.includes('CHANGED'), 'The changed fixture did not change the preview.')
  assert(english.includes('Order confirmed') && english.includes('Hello'), 'Locale selection did not choose en-US.')
  assert(!english.includes('Pedido confirmado'), 'The English preview also showed the Portuguese document.')
  assert(
    portuguese.includes('Pedido confirmado') && portuguese.includes('Retirada na loja'),
    'The missing-locale fallback did not use pt-BR.',
  )
  assert(!portuguese.includes('Rua São João'), 'The pickup alternative showed the address.')
  assert(
    english.includes('Order<!-- --> ORD-A') && english.includes('Order<!-- --> ORD-B'),
    'The order number was not displayed.',
  )
  assert(countOf(english, '>ORD-A</p>') === 2, 'The parent context was not repeated on each item.')
  assert(countOf(english, '>ORD-B</p>') === 1, 'The second order lost the parent context.')
  assert(english.includes('Ana &amp; &quot;Lia&quot; &lt;João&gt;'), 'Text escaping diverged.')
  assert(english.includes('Camisa &amp; &quot;Azul&quot;'), 'Item name escaping diverged.')
  assert(
    english.includes('src="https://example.com/images/camisa.png?x&#x3D;1&amp;y&#x3D;2"'),
    'The first item image diverged.',
  )
  assert(english.includes('src="https://example.com/images/meia.png"'), 'The second item image diverged.')
  assert(english.includes('src="https://example.com/images/bone.png"'), 'The second order image diverged.')
  assert(!english.includes('rel="preload"'), 'The preview kept an image preload.')
  const englishHead = english.slice(english.toLowerCase().indexOf('<head'), english.toLowerCase().indexOf('</head>'))
  assert(!englishHead.includes('camisa.png') && !englishHead.includes('meia.png'), 'Head received an item URL.')
  assert(english.includes('João') && english.includes('São'), 'Unicode was lost.')
  assert(english.includes('200,00') && english.includes('0,00'), 'formatCurrency did not run on the artifact.')
  assert(
    english.includes('8 business days') && english.includes('3 business days'),
    'replace did not apply one occurrence.',
  )
  assert(
    english.includes('Rua São João 10') && english.includes('Avenida Central'),
    'The present address was not displayed.',
  )
  assert(countOf(english, '<!DOCTYPE') === 1, 'The English preview is not a single document.')
  assert(
    countOf(portuguese, '<html') === 1 && countOf(portuguese, '<head') === 1 && countOf(portuguese, '<body') === 1,
    'The Portuguese preview broke the document structure.',
  )

  const unknown = structuredClone(delivery)
  const unknownOrder = unknown.orders[0]
  assert(unknownOrder?.clientPreferencesData !== undefined, 'The delivery fixture has no locale.')
  unknownOrder.clientPreferencesData.locale = 'fr-FR'
  const fallback = evaluate(written, unknown)
  assert(
    fallback.includes('Pedido confirmado') && !fallback.includes('Order confirmed'),
    'An unknown locale did not fall back to the default.',
  )

  const emptyDir = await mkdtemp(path.join(tmpdir(), 'vtex-email-'))
  const brokenCatalogs = structuredClone(catalogs)
  delete brokenCatalogs['pt-BR']['order.pickup']
  const missingKey = await compileLocale('pt-BR', brokenCatalogs['pt-BR'])
  assert(
    !missingKey.ok && missingKey.diagnostics.some((item) => item.code === 'I18N001'),
    'A missing key did not stop generation.',
  )
  assert((await readdir(emptyDir)).length === 0, 'The generation failure created a file.')

  const corrupted = restoreHandlebars('vtxtruncated', new Map())
  assert(!corrupted.ok && corrupted.diagnostics[0]?.code === 'TOK001', 'A truncated token did not fail.')
  assert((await readdir(emptyDir)).length === 0, 'The integrity failure created a file.')

  const catalogsA = structuredClone(catalogs)
  const catalogsB = structuredClone(catalogs)
  catalogsA['pt-BR']['order.confirmed.title'] = 'TITLE-AAA'
  catalogsA['en-US']['order.confirmed.title'] = 'TITLE-AAA'
  catalogsB['pt-BR']['order.confirmed.title'] = 'TITLE-BBB'
  catalogsB['en-US']['order.confirmed.title'] = 'TITLE-BBB'
  const [parallelA, parallelB] = await Promise.all([compileMerged(catalogsA), compileMerged(catalogsB)])
  assert(parallelA.ok && parallelB.ok, 'Parallel compilation failed.')
  if (!parallelA.ok || !parallelB.ok) return
  assert(
    parallelA.content.includes('TITLE-AAA') && !parallelA.content.includes('TITLE-BBB'),
    'Locale leaked into compilation A.',
  )
  assert(
    parallelB.content.includes('TITLE-BBB') && !parallelB.content.includes('TITLE-AAA'),
    'Locale leaked into compilation B.',
  )
  assert(
    opaqueTokenIssue(parallelA.content) === null && opaqueTokenIssue(parallelB.content) === null,
    'Parallel compilation left a marker.',
  )
}

export function profileUsedByProof(): Profile {
  return p0Profile
}
