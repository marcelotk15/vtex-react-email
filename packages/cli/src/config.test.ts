import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { outputDirectoryError, validateConfig } from './config/config'
import { duplicateId, fileKeyFromPath, schemaPathForKey } from './project/discover'

const tailwind = { presets: [] }

function projectConfig(extra: Record<string, unknown> = {}) {
  return {
    emails: ['emails/**/*.email.tsx'],
    outDir: 'dist',
    target: { profile: './vtex-target.ts' },
    i18n: {
      locales: ['pt-BR', 'en-US'],
      defaultLocale: 'pt-BR',
      catalogs: 'locales/{locale}.json',
      missingKey: 'error',
      localePath: 'locale',
    },
    tailwind,
    ...extra,
  }
}

describe('project config', () => {
  it('rejects an unknown key and an output directory at the project root', () => {
    const root = path.resolve('examples/basic-store')
    const unknown = validateConfig(projectConfig({ extra: true }), root)
    expect(unknown.ok).toBe(false)
    if (unknown.ok) return
    expect(unknown.diagnostics[0]?.code).toBe('CFG001')
    const rooted = validateConfig(projectConfig({ outDir: '.' }), root)
    expect(rooted.ok).toBe(false)
    expect(outputDirectoryError(root, path.resolve(root, '..'), ['emails'])).toMatch(/ancestor/)
  })

  it('resolves paths, fixturesDir, schemasDir, and localePath from the config directory', () => {
    const root = path.resolve('examples/basic-store')
    const validated = validateConfig(projectConfig({ fixturesDir: 'fixtures' }), root)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.config.outDir).toBe(path.resolve(root, 'dist'))
    expect(validated.config.profilePath).toBe(path.resolve(root, 'vtex-target.ts'))
    expect(validated.config.fixturesDir).toBe('fixtures')
    expect(validated.config.schemasDir).toBe('schemas')
    expect(validated.config.localePath).toBe('locale')
    expect(fileKeyFromPath('emails/auth-code.email.tsx')).toBe('auth-code')
    expect(schemaPathForKey(validated.config, 'auth-code')).toBe(path.resolve(root, 'schemas', 'auth-code.ts'))
  })

  it('accepts an explicit schemasDir override', () => {
    const root = path.resolve('examples/basic-store')
    const validated = validateConfig(projectConfig({ schemasDir: 'contracts' }), root)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.config.schemasDir).toBe('contracts')
  })

  it('reports a duplicate id', () => {
    expect(duplicateId(['order-confirmed', 'auth-code', 'order-confirmed'])).toBe('order-confirmed')
  })
})
