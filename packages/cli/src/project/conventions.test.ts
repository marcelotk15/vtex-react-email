import { type Diagnostic } from '@vtex-email/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { fileKeyFromPath } from './discover'
import { fixtureIdFromName, isPayloadFile, readFixtures } from './fixtures'
import { parseEmailSettings } from './settings'

describe('authoring conventions', () => {
  it('derives the file key by stripping .email.tsx', () => {
    expect(fileKeyFromPath(path.join('emails', 'auth-code.email.tsx'))).toBe('auth-code')
    expect(fileKeyFromPath(path.join('emails', 'nested', 'order-confirmed.email.tsx'))).toBe('order-confirmed')
    expect(fileKeyFromPath(path.join('emails', 'auth-code.tsx'))).toBeNull()
  })

  it('classifies payload and sidecar names', () => {
    expect(isPayloadFile('default.json')).toBe(true)
    expect(isPayloadFile('default.jsonc')).toBe(true)
    expect(isPayloadFile('default.meta.json')).toBe(false)
    expect(isPayloadFile('default.meta.jsonc')).toBe(false)
    expect(fixtureIdFromName('default.json')).toBe('default')
    expect(fixtureIdFromName('default.jsonc')).toBe('default')
    expect(fixtureIdFromName('default.meta.json')).toBeNull()
  })

  it('rejects unknown settings fields and invalid shapes', () => {
    const bad = parseEmailSettings({ template: () => null, id: 1 }, 'email.tsx')
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.diagnostics.some((item) => item.message.includes('Unknown settings field'))).toBe(true)
    expect(bad.diagnostics.some((item) => item.message.includes('settings.id'))).toBe(true)

    const ok = parseEmailSettings(
      {
        id: 'custom',
        i18n: { localePath: 'locale', locales: ['pt-BR'], aliases: { 'pt-br': 'pt-BR' } },
      },
      'email.tsx',
    )
    expect(ok).toEqual({
      ok: true,
      settings: {
        id: 'custom',
        i18n: {
          localePath: 'locale',
          locales: ['pt-BR'],
          aliases: { 'pt-br': 'pt-BR' },
        },
      },
    })
  })
})

describe('fixture loading', () => {
  it('loads jsonc with comments and trailing commas, and reports collisions', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-fixtures-'))
    const directory = path.join(root, 'fixtures', 'demo')
    await mkdir(directory, { recursive: true })
    await writeFile(
      path.join(directory, 'valid.jsonc'),
      `// comment\n{\n  "locale": "pt-BR",\n  "code": "1",\n}\n`,
    )
    await writeFile(
      path.join(directory, 'valid.meta.json'),
      JSON.stringify({
        description: 'ok',
        origin: 'test',
        event: 'demo',
        purpose: 'jsonc',
        expect: 'valid',
      }),
    )
    await writeFile(path.join(directory, 'broken.jsonc'), `{\n  "code":\n}`)
    await writeFile(
      path.join(directory, 'broken.meta.json'),
      JSON.stringify({
        description: 'broken',
        origin: 'test',
        event: 'demo',
        purpose: 'error',
        expect: 'valid',
      }),
    )
    await writeFile(path.join(directory, 'clash.json'), '{"code":"a"}')
    await writeFile(path.join(directory, 'clash.jsonc'), '{"code":"b"}')
    await writeFile(
      path.join(directory, 'clash.meta.json'),
      JSON.stringify({
        description: 'clash',
        origin: 'test',
        event: 'demo',
        purpose: 'collision',
        expect: 'valid',
      }),
    )

    const diagnostics: Diagnostic[] = []
    const fixtures = await readFixtures(root, 'demo', 'fixtures/demo', diagnostics)
    expect(fixtures.map((item) => item.id)).toEqual(['valid'])
    expect(fixtures[0]?.data).toEqual({ locale: 'pt-BR', code: '1' })
    expect(diagnostics.some((item) => item.message.includes('collides'))).toBe(true)
    const broken = diagnostics.find((item) => item.fixtureId === 'broken')
    expect(broken?.source?.file?.endsWith('broken.jsonc')).toBe(true)
    expect(typeof broken?.source?.line).toBe('number')
    expect(typeof broken?.source?.column).toBe('number')

    await rm(root, { recursive: true, force: true })
  })

  it('errors when the fixtures directory is missing and accepts an empty directory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-fixtures-missing-'))
    const missingDiagnostics: Diagnostic[] = []
    const missing = await readFixtures(root, 'demo', 'fixtures/missing', missingDiagnostics)
    expect(missing).toEqual([])
    expect(missingDiagnostics[0]?.message).toMatch(/not found/)

    const emptyDir = path.join(root, 'fixtures', 'empty')
    await mkdir(emptyDir, { recursive: true })
    const emptyDiagnostics: Diagnostic[] = []
    const empty = await readFixtures(root, 'demo', 'fixtures/empty', emptyDiagnostics)
    expect(empty).toEqual([])
    expect(emptyDiagnostics).toEqual([])
    await rm(root, { recursive: true, force: true })
  })

  it('resolves directories with spaces', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex fixtures space '))
    const directory = path.join(root, 'fixtures', 'auth code')
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, 'default.json'), '{"code":"x"}')
    await writeFile(
      path.join(directory, 'default.meta.json'),
      JSON.stringify({
        description: 'space',
        origin: 'test',
        event: 'demo',
        purpose: 'path',
        expect: 'valid',
      }),
    )
    const diagnostics: Diagnostic[] = []
    const fixtures = await readFixtures(root, 'demo', path.join('fixtures', 'auth code'), diagnostics)
    expect(fixtures).toHaveLength(1)
    expect(diagnostics).toEqual([])
    await rm(root, { recursive: true, force: true })
  })
})

describe('schema conventions', () => {
  it('keeps a zod schema reference stable for settings overrides', () => {
    const schema = z.object({ code: z.string() })
    const parsed = parseEmailSettings({ schema }, 'email.tsx')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.settings.schema).toBe(schema)
  })

  it(
    'loads the conventional default-export schema for basic-store emails',
    async () => {
      const { discoverEmails } = await import('./discover')
      const { loadProjectConfig } = await import('../config/load-config')
      const loaded = await loadProjectConfig(path.resolve('examples/basic-store/vtex-email.config.ts'))
      expect(loaded.ok).toBe(true)
      if (!loaded.ok) return
      const discovered = await discoverEmails(loaded.config)
      expect(discovered.ok).toBe(true)
      if (!discovered.ok) return
      const auth = discovered.emails.find((email) => email.fileKey === 'auth-code')
      const order = discovered.emails.find((email) => email.fileKey === 'order-confirmed')
      expect(auth?.definition.schema).toBeTruthy()
      expect(order?.definition.schema).toBeTruthy()
      expect(auth?.definition.id).toBe('auth-code')
    },
    30_000,
  )
})
