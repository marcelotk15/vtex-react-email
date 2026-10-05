import {
  createSeedProject,
  removeTempDir,
  SEED_FREEZE_MARKER,
  SEED_GREETING_EN,
  SEED_GREETING_PT,
  SEED_OPS,
  SEED_WELCOME,
} from '@vtex-email/test-harness'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildProject, validateProject } from './project/build-project'
import { exportPreview, previewBuiltEmail, renderPreview } from './project/preview-evaluation'

async function missing(file: string): Promise<boolean> {
  try {
    await access(file)
    return false
  } catch {
    return true
  }
}

async function withSeed(run: (seed: Awaited<ReturnType<typeof createSeedProject>>) => Promise<void>): Promise<void> {
  const seed = await createSeedProject()
  try {
    await run(seed)
  } finally {
    await removeTempDir(seed.root)
  }
}

describe('synthetic seed project', () => {
  it('validates in memory and builds without freezing fixtures', async () => {
    await withSeed(async ({ root, configPath }) => {
      const dist = path.join(root, 'dist')
      const validated = await validateProject({ configPath })
      expect(validated).toMatchObject({ ok: true })
      expect(await missing(dist)).toBe(true)

      const first = await buildProject({ configPath })
      const second = await buildProject({ configPath })
      expect(first).toMatchObject({ ok: true })
      expect(second.ok).toBe(true)
      const welcome = first.emails.find((email) => email.id === SEED_WELCOME)
      const ops = first.emails.find((email) => email.id === SEED_OPS)
      const welcomeAgain = second.emails.find((email) => email.id === SEED_WELCOME)
      expect(welcome?.files.find((file) => file.role === 'merged')?.sha256).toBe(
        welcomeAgain?.files.find((file) => file.role === 'merged')?.sha256,
      )
      const merged = welcome?.files.find((file) => file.role === 'merged')?.content ?? ''
      const opsHtml = ops?.files.map((file) => file.content).join('\n') ?? ''
      expect(merged.includes('{{#eq ')).toBe(true)
      expect(merged.includes('"pt-br"')).toBe(true)
      expect(merged.includes('"en-US"')).toBe(true)
      expect(opsHtml.includes('{{#eq ')).toBe(true)
      expect(merged.includes(SEED_FREEZE_MARKER)).toBe(false)
      expect(opsHtml.includes(SEED_FREEZE_MARKER)).toBe(false)
      expect(welcome?.diagnostics.some((item) => item.code === 'CSS002' || item.code === 'PATH001')).toBe(false)
      expect(
        welcome?.manifest?.capabilities.some((item) => item.name === 'eq' && item.evidence === 'experimental'),
      ).toBe(true)
      expect(
        welcome?.diagnostics.some(
          (item) => item.code === 'TARGET001' && item.severity === 'warning' && item.message.includes('Capability eq'),
        ),
      ).toBe(true)
      expect(ops?.manifest?.capabilities.some((item) => item.name === 'eq')).toBe(true)
      expect(ops?.diagnostics.some((item) => item.message.includes('Capability eq'))).toBe(true)
      expect(first.manifest?.homologation).toBe('experimental')

      const fixtureFile = path.join(root, 'src/fixtures/welcome/full.jsonc')
      const before = await readFile(fixtureFile, 'utf8')
      const runtime = await renderPreview({
        configPath,
        emailId: SEED_WELCOME,
        fixtureId: 'full',
        mode: 'runtime',
      })
      const forced = await renderPreview({
        configPath,
        emailId: SEED_WELCOME,
        fixtureId: 'full',
        mode: 'forced',
        locale: 'pt-BR',
      })
      const missingLocale = await renderPreview({
        configPath,
        emailId: SEED_WELCOME,
        fixtureId: 'missing-locale',
        mode: 'runtime',
      })
      const unknown = await renderPreview({
        configPath,
        emailId: SEED_WELCOME,
        fixtureId: 'unknown-locale',
        mode: 'runtime',
      })
      expect(runtime.ok && runtime.selector).toBe(true)
      expect(runtime.html.includes(SEED_GREETING_EN)).toBe(true)
      const fromBuilt = previewBuiltEmail({ email: welcome!, fixtureId: 'full', mode: 'runtime' })
      expect(fromBuilt.html).toBe(runtime.html)
      expect(fromBuilt.source).toBe(runtime.source)
      expect(fromBuilt.payloadLocale).toBe('en-US')
      const forcedBuilt = previewBuiltEmail({ email: welcome!, fixtureId: 'full', mode: 'forced', locale: 'pt-BR' })
      expect(forcedBuilt.html).toBe(forced.html)
      expect(forced.selector).toBe(true)
      expect(forced.html.includes(SEED_GREETING_PT) || forced.html.includes('OlÃ¡')).toBe(true)
      expect(forced.html.includes(SEED_GREETING_EN)).toBe(false)
      expect(missingLocale.html.includes(SEED_GREETING_PT) || missingLocale.html.includes('OlÃ¡')).toBe(true)
      expect(unknown.html.includes(SEED_GREETING_PT) || unknown.html.includes('OlÃ¡')).toBe(true)
      expect(unknown.html.includes(SEED_GREETING_EN)).toBe(false)
      expect(await readFile(fixtureFile, 'utf8')).toBe(before)

      const welcomeFile = path.join(dist, 'welcome.html')
      const welcomeBytes = await readFile(welcomeFile, 'utf8')
      const opsOnly = await buildProject({ configPath, onlyId: SEED_OPS })
      expect(opsOnly).toMatchObject({ ok: true })
      expect(await readFile(welcomeFile, 'utf8')).toBe(welcomeBytes)
    })
  }, 120_000)

  it('keeps the previous artifacts when warnings are promoted and when the locale is unknown', async () => {
    await withSeed(async ({ root, configPath }) => {
      const dist = path.join(root, 'dist')
      const primed = await buildProject({ configPath })
      expect(primed).toMatchObject({ ok: true })

      const welcomeFile = path.join(dist, 'welcome.html')
      const english = path.join(dist, 'locales/en-US/welcome.html')
      const opsFile = path.join(dist, 'locales/pt-BR/ops-notice.html')
      const before = await readFile(welcomeFile, 'utf8')
      const englishBytes = await readFile(english, 'utf8')
      const opsBytes = await readFile(opsFile, 'utf8')
      const promoted = await buildProject({ configPath, warningsAsErrors: true })
      expect(promoted.ok).toBe(false)
      expect(promoted.exitCode).toBe(1)
      expect(promoted.wrote).toEqual([])
      expect(
        promoted.diagnostics.some(
          (item) => item.code === 'TARGET001' && item.severity === 'error' && item.message.includes('Capability eq'),
        ),
      ).toBe(true)
      expect(await readFile(welcomeFile, 'utf8')).toBe(before)

      const unknown = await buildProject({ configPath, locale: 'fr-FR' })
      expect(unknown.exitCode).toBe(2)
      expect(unknown.wrote).toEqual([])
      expect(await readFile(welcomeFile, 'utf8')).toBe(before)

      const locale = await buildProject({ configPath, onlyId: SEED_WELCOME, locale: 'pt-BR' })
      expect(locale).toMatchObject({ ok: true })
      expect(locale.wrote).toContain('locales/pt-BR/welcome.html')
      expect(locale.wrote).not.toContain('welcome.html')
      expect(locale.preserved).toContain('welcome.html')
      expect(locale.preserved).toContain('locales/en-US/welcome.html')
      expect(await readFile(welcomeFile, 'utf8')).toBe(before)
      expect(await readFile(english, 'utf8')).toBe(englishBytes)
      expect(await readFile(opsFile, 'utf8')).toBe(opsBytes)
    })
  }, 120_000)

  it('rejects an output directory that would mix preview with production', async () => {
    await withSeed(async ({ root, configPath }) => {
      const preview = {
        configPath,
        emailId: SEED_WELCOME,
        fixtureId: 'full',
      }
      expect((await exportPreview({ ...preview, outDir: path.join(root, 'dist') })).exitCode).toBe(2)
      expect((await exportPreview({ ...preview, outDir: path.join(root, 'src') })).exitCode).toBe(2)
      expect((await exportPreview({ ...preview, outDir: root })).exitCode).toBe(2)
    })
  })

  it('does not create a preview directory when validation fails, and writes resolved html when it passes', async () => {
    await withSeed(async ({ configPath }) => {
      const blocked = path.join(tmpdir(), `vtex-preview-blocked-${Date.now()}`)
      const failed = await exportPreview({
        configPath,
        emailId: SEED_WELCOME,
        fixtureId: 'full',
        outDir: blocked,
        warningsAsErrors: true,
      })
      expect(failed.ok).toBe(false)
      expect(failed.exitCode).toBe(1)
      expect(failed.wrote).toEqual([])
      expect(await missing(blocked)).toBe(true)

      const outDir = await mkdtemp(path.join(tmpdir(), 'vtex email '))
      try {
        const exported = await exportPreview({
          configPath,
          emailId: SEED_WELCOME,
          fixtureId: 'full',
          outDir,
        })
        expect(exported).toMatchObject({ ok: true })
        const html = await readFile(path.join(outDir, 'welcome.full.html'), 'utf8')
        expect(html.includes('{{')).toBe(false)
        expect(html.includes(SEED_GREETING_EN)).toBe(true)
      } finally {
        await rm(outDir, { recursive: true, force: true })
      }
    })
  }, 120_000)

  it('does not write when unverified capabilities are errors', async () => {
    await withSeed(async ({ root, configPath }) => {
      const source = await readFile(configPath, 'utf8')
      await writeFile(configPath, source.replace("unverifiedCapability: 'warning'", "unverifiedCapability: 'error'"))
      const built = await buildProject({ configPath })
      expect(built.ok).toBe(false)
      expect(built.exitCode).toBe(1)
      expect(built.wrote).toEqual([])
      expect(await missing(path.join(root, 'dist'))).toBe(true)
      const welcome = built.emails.find((email) => email.id === SEED_WELCOME)
      const ops = built.emails.find((email) => email.id === SEED_OPS)
      expect(
        welcome?.diagnostics.some(
          (item) => item.code === 'TARGET001' && item.severity === 'error' && item.message.includes('Capability eq'),
        ),
      ).toBe(true)
      expect(ops?.diagnostics.some((item) => item.message.includes('Capability eq'))).toBe(true)
    })
  }, 120_000)
})
