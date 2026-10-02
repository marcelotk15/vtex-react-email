import { describe, expect, it } from 'vitest'

import { defaultPrefs, prefsKey, readPrefs, writePrefs, type PrefsStorage } from './prefs'

function memory(): PrefsStorage & { raw(): string | null } {
  let value: string | null = null
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next
    },
    raw: () => value,
  }
}

describe('preview preferences', () => {
  it('keeps only visual preferences and drops unknown fields', () => {
    const storage = memory()
    storage.setItem(
      prefsKey,
      JSON.stringify({
        sidebar: 900,
        sidebarOpen: false,
        properties: 10,
        propertiesOpen: false,
        propertiesTab: 'diagnostics',
        inspector: 10,
        inspectorOpen: 'yes',
        tab: 'source',
        viewport: 'wide',
        expanded: ['order', 4],
        data: { secret: true },
        html: '<p>payload</p>',
      }),
    )
    const prefs = readPrefs(storage)
    expect(prefs).toEqual({
      sidebar: 360,
      sidebarOpen: false,
      properties: 220,
      propertiesOpen: false,
      propertiesTab: 'diagnostics',
      inspector: 160,
      inspectorOpen: true,
      tab: 'source',
      viewport: 'wide',
      expanded: ['order'],
    })
    expect(prefs).not.toHaveProperty('data')
    expect(prefs).not.toHaveProperty('html')
  })

  it('migrates legacy diagnostics tab into the properties panel', () => {
    const storage = memory()
    storage.setItem(
      'vtex-email.preview.ui.v1',
      JSON.stringify({
        sidebar: 248,
        sidebarOpen: true,
        inspector: 280,
        inspectorOpen: true,
        tab: 'diagnostics',
        viewport: 'desktop',
        expanded: [],
      }),
    )
    const prefs = readPrefs(storage)
    expect(prefs.tab).toBe('data')
    expect(prefs.propertiesTab).toBe('diagnostics')
    expect(prefs.propertiesOpen).toBe(true)
  })

  it('writes a versioned object without fixture content', () => {
    const storage = memory()
    writePrefs(storage, { ...defaultPrefs, viewport: 'mobile', expanded: ['auth-code'] })
    const stored = JSON.parse(storage.raw() ?? '{}') as Record<string, unknown>
    expect(Object.keys(stored).sort()).toEqual(
      [
        'expanded',
        'inspector',
        'inspectorOpen',
        'properties',
        'propertiesOpen',
        'propertiesTab',
        'sidebar',
        'sidebarOpen',
        'tab',
        'viewport',
      ].sort(),
    )
    expect(JSON.stringify(stored)).not.toContain('fixture')
  })

  it('falls back when storage is empty or broken', () => {
    expect(readPrefs(null).viewport).toBe('desktop')
    const storage = memory()
    storage.setItem(prefsKey, '{')
    expect(readPrefs(storage)).toEqual({ ...defaultPrefs, expanded: [] })
  })
})
