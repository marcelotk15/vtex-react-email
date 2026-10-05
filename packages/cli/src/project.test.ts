import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildProject, validateProject } from './project/build-project'
import { exportPreview, previewBuiltEmail, renderPreview } from './project/preview-evaluation'

const root = path.resolve('examples/basic-store')
const configPath = path.join(root, 'vtex-email.config.ts')
const dist = path.join(root, 'dist')

async function missing(file: string): Promise<boolean> {
  try {
    await access(file)
    return false
  } catch {
    return true
  }
}

describe('basic store project', () => {
  it('validates in memory and builds two schemas without freezing fixtures', async () => {
    await rm(dist, { recursive: true, force: true })
    const validated = await validateProject({ configPath })
    expect(validated).toMatchObject({ ok: true })
    expect(await missing(dist)).toBe(true)

    const first = await buildProject({ configPath })
    const second = await buildProject({ configPath })
    expect(first).toMatchObject({ ok: true })
    expect(second.ok).toBe(true)
    const order = first.emails.find((email) => email.id === 'order-confirmed')
    const auth = first.emails.find((email) => email.id === 'auth-code')
    const orderAgain = second.emails.find((email) => email.id === 'order-confirmed')
    expect(order?.files.find((file) => file.role === 'merged')?.sha256).toBe(
      orderAgain?.files.find((file) => file.role === 'merged')?.sha256,
    )
    const merged = order?.files.find((file) => file.role === 'merged')?.content ?? ''
    const authHtml = auth?.files.map((file) => file.content).join('\n') ?? ''
    expect(merged.includes('{{#eq ')).toBe(true)
    expect(merged.includes('"pt-br"')).toBe(true)
    expect(merged.includes('"en-US"')).toBe(true)
    expect(authHtml.includes('{{#eq ')).toBe(false)
    expect(merged.includes('ORDER-KEEP')).toBe(false)
    expect(authHtml.includes('AUTH-KEEP')).toBe(false)
    expect(merged.includes('AUTH-KEEP')).toBe(false)
    expect(authHtml.includes('ORDER-KEEP')).toBe(false)
    expect(merged.includes('sm_p-4')).toBe(true)
    expect(order?.diagnostics.some((item) => item.code === 'CSS002' || item.code === 'PATH001')).toBe(false)
    expect(order?.manifest?.capabilities.some((item) => item.name === 'eq' && item.evidence === 'experimental')).toBe(
      true,
    )
    expect(
      order?.diagnostics.some(
        (item) => item.code === 'TARGET001' && item.severity === 'warning' && item.message.includes('Capability eq'),
      ),
    ).toBe(true)
    expect(auth?.manifest?.capabilities.some((item) => item.name === 'eq')).toBe(false)
    expect(auth?.diagnostics.some((item) => item.message.includes('Capability eq'))).toBe(false)
    expect(first.manifest?.homologation).toBe('experimental')

    const fixtureFile = path.join(root, 'fixtures/order-confirmed/delivery.json')
    const before = await readFile(fixtureFile, 'utf8')
    const runtime = await renderPreview({
      configPath,
      emailId: 'order-confirmed',
      fixtureId: 'delivery',
      mode: 'runtime',
    })
    const forced = await renderPreview({
      configPath,
      emailId: 'order-confirmed',
      fixtureId: 'delivery',
      mode: 'forced',
      locale: 'pt-BR',
    })
    const missingLocale = await renderPreview({
      configPath,
      emailId: 'order-confirmed',
      fixtureId: 'missing-locale',
      mode: 'runtime',
    })
    const unknown = await renderPreview({
      configPath,
      emailId: 'order-confirmed',
      fixtureId: 'unknown-locale',
      mode: 'runtime',
    })
    expect(runtime.ok && runtime.selector).toBe(true)
    expect(runtime.html.includes('Hello,')).toBe(true)
    const fromBuilt = previewBuiltEmail({ email: order!, fixtureId: 'delivery', mode: 'runtime' })
    expect(fromBuilt.html).toBe(runtime.html)
    expect(fromBuilt.source).toBe(runtime.source)
    expect(fromBuilt.payloadLocale).toBe('en-US')
    const forcedBuilt = previewBuiltEmail({ email: order!, fixtureId: 'delivery', mode: 'forced', locale: 'pt-BR' })
    expect(forcedBuilt.html).toBe(forced.html)
    expect(forced.selector).toBe(true)
    expect(forced.html.includes('Olá,')).toBe(true)
    expect(forced.html.includes('Hello,')).toBe(false)
    expect(missingLocale.html.includes('Olá,')).toBe(true)
    expect(unknown.html.includes('Olá,')).toBe(true)
    expect(unknown.html.includes('Hello,')).toBe(false)
    expect(await readFile(fixtureFile, 'utf8')).toBe(before)

    const orderFile = path.join(dist, 'order-confirmed.html')
    const orderBytes = await readFile(orderFile, 'utf8')
    const authOnly = await buildProject({ configPath, onlyId: 'auth-code' })
    expect(authOnly).toMatchObject({ ok: true })
    expect(await readFile(orderFile, 'utf8')).toBe(orderBytes)
  }, 120_000)

  it('keeps the previous artifacts when warnings are promoted and when the locale is unknown', async () => {
    const orderFile = path.join(dist, 'order-confirmed.html')
    const english = path.join(dist, 'locales/en-US/order-confirmed.html')
    const authFile = path.join(dist, 'locales/pt-BR/auth-code.html')
    const before = await readFile(orderFile, 'utf8')
    const englishBytes = await readFile(english, 'utf8')
    const authBytes = await readFile(authFile, 'utf8')
    const promoted = await buildProject({ configPath, warningsAsErrors: true })
    expect(promoted.ok).toBe(false)
    expect(promoted.exitCode).toBe(1)
    expect(promoted.wrote).toEqual([])
    expect(
      promoted.diagnostics.some(
        (item) => item.code === 'TARGET001' && item.severity === 'error' && item.message.includes('Capability eq'),
      ),
    ).toBe(true)
    expect(await readFile(orderFile, 'utf8')).toBe(before)

    const unknown = await buildProject({ configPath, locale: 'fr-FR' })
    expect(unknown.exitCode).toBe(2)
    expect(unknown.wrote).toEqual([])
    expect(await readFile(orderFile, 'utf8')).toBe(before)

    const locale = await buildProject({ configPath, onlyId: 'order-confirmed', locale: 'pt-BR' })
    expect(locale).toMatchObject({ ok: true })
    expect(locale.wrote).toContain('locales/pt-BR/order-confirmed.html')
    expect(locale.wrote).not.toContain('order-confirmed.html')
    expect(locale.preserved).toContain('order-confirmed.html')
    expect(locale.preserved).toContain('locales/en-US/order-confirmed.html')
    expect(await readFile(orderFile, 'utf8')).toBe(before)
    expect(await readFile(english, 'utf8')).toBe(englishBytes)
    expect(await readFile(authFile, 'utf8')).toBe(authBytes)
  }, 120_000)

  it('rejects an output directory that would mix preview with production', async () => {
    const preview = {
      configPath,
      emailId: 'order-confirmed',
      fixtureId: 'delivery',
    }
    expect((await exportPreview({ ...preview, outDir: dist })).exitCode).toBe(2)
    expect((await exportPreview({ ...preview, outDir: path.join(root, 'emails') })).exitCode).toBe(2)
    expect((await exportPreview({ ...preview, outDir: root })).exitCode).toBe(2)
  })

  it('does not create a preview directory when validation fails, and writes resolved html when it passes', async () => {
    const blocked = path.join(tmpdir(), `vtex-preview-blocked-${Date.now()}`)
    const failed = await exportPreview({
      configPath,
      emailId: 'order-confirmed',
      fixtureId: 'delivery',
      outDir: blocked,
      warningsAsErrors: true,
    })
    expect(failed.ok).toBe(false)
    expect(failed.exitCode).toBe(1)
    expect(failed.wrote).toEqual([])
    expect(await missing(blocked)).toBe(true)

    const outDir = await mkdtemp(path.join(tmpdir(), 'vtex email '))
    const exported = await exportPreview({
      configPath,
      emailId: 'order-confirmed',
      fixtureId: 'delivery',
      outDir,
    })
    expect(exported).toMatchObject({ ok: true })
    const html = await readFile(path.join(outDir, 'order-confirmed.delivery.html'), 'utf8')
    expect(html.includes('{{')).toBe(false)
    expect(html.includes('Hello,')).toBe(true)
  }, 120_000)

  it('does not write when unverified capabilities are errors, and still ignores unused eq on per-locale output', async () => {
    const destination = await mkdtemp(path.join(root, '.cli- policy-'))
    try {
      const copied = await copyStore(destination, 'error')
      const built = await buildProject({ configPath: copied })
      expect(built.ok).toBe(false)
      expect(built.exitCode).toBe(1)
      expect(built.wrote).toEqual([])
      expect(await missing(path.join(destination, 'dist'))).toBe(true)
      const order = built.emails.find((email) => email.id === 'order-confirmed')
      const auth = built.emails.find((email) => email.id === 'auth-code')
      expect(
        order?.diagnostics.some(
          (item) => item.code === 'TARGET001' && item.severity === 'error' && item.message.includes('Capability eq'),
        ),
      ).toBe(true)
      expect(auth?.diagnostics.some((item) => item.message.includes('Capability eq'))).toBe(false)
    } finally {
      await rm(destination, { recursive: true, force: true })
    }
  }, 120_000)
})

async function copyStore(destination: string, unverified: 'error' | 'warning'): Promise<string> {
  await mkdir(destination, { recursive: true })
  for (const name of ['emails', 'schemas', 'locales', 'fixtures']) {
    await cp(path.join(root, name), path.join(destination, name), { recursive: true })
  }
  const source = await readFile(configPath, 'utf8')
  const config = source.replace("unverifiedCapability: 'warning'", `unverifiedCapability: '${unverified}'`)
  const copied = path.join(destination, 'vtex-email.config.ts')
  await writeFile(copied, config)
  return copied
}
