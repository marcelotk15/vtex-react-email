import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { outputDirectoryError, validateConfig } from './config'
import { duplicateId } from './project'

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

  it('resolves paths from the config directory', () => {
    const root = path.resolve('examples/basic-store')
    const validated = validateConfig(projectConfig(), root)
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.config.outDir).toBe(path.resolve(root, 'dist'))
    expect(validated.config.profilePath).toBe(path.resolve(root, 'vtex-target.ts'))
  })

  it('reports a duplicate id', () => {
    expect(duplicateId(['order-confirmed', 'auth-code', 'order-confirmed'])).toBe('order-confirmed')
  })
})
