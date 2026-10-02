import { describe, expect, it } from 'vitest'

import {
  applyResolvedTheme,
  defaultThemePreference,
  isThemePreference,
  readSystemDark,
  readThemePreference,
  resolveTheme,
  themeBootScript,
  themeKey,
  writeThemePreference,
  type ThemeStorage,
} from './theme'

function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & { store: Record<string, string> } {
  const store = { ...initial }
  return {
    store,
    getItem(key) {
      return key in store ? store[key]! : null
    },
    setItem(key, value) {
      store[key] = value
    },
  }
}

describe('theme preference', () => {
  it('defaults to system and validates stored values', () => {
    expect(defaultThemePreference).toBe('system')
    expect(isThemePreference('white')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('light')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
    expect(readThemePreference(null)).toBe('system')
    expect(readThemePreference(memoryStorage())).toBe('system')
    expect(readThemePreference(memoryStorage({ [themeKey]: 'dark' }))).toBe('dark')
    expect(readThemePreference(memoryStorage({ [themeKey]: 'nope' }))).toBe('system')
  })

  it('tolerates unavailable storage', () => {
    const broken: ThemeStorage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    }
    expect(readThemePreference(broken)).toBe('system')
    expect(() => writeThemePreference(broken, 'dark')).not.toThrow()
    expect(() => writeThemePreference(null, 'white')).not.toThrow()
  })

  it('persists a valid preference', () => {
    const storage = memoryStorage()
    writeThemePreference(storage, 'white')
    expect(storage.store[themeKey]).toBe('white')
    expect(readThemePreference(storage)).toBe('white')
  })

  it('resolves preference against the system scheme', () => {
    expect(resolveTheme('white', true)).toBe('white')
    expect(resolveTheme('white', false)).toBe('white')
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('white')
    expect(readSystemDark({ matches: true })).toBe(true)
    expect(readSystemDark({ matches: false })).toBe(false)
    expect(readSystemDark(null)).toBe(false)
  })

  it('applies the resolved theme on the document root', () => {
    const root = {
      dataset: {} as Record<string, string>,
      style: { colorScheme: '' },
    }
    applyResolvedTheme(root as unknown as HTMLElement, 'dark')
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
    applyResolvedTheme(root as unknown as HTMLElement, 'white')
    expect(root.dataset.theme).toBe('white')
    expect(root.style.colorScheme).toBe('light')
  })

  it('emits a boot script that uses the theme key and defaults to system', () => {
    const script = themeBootScript()
    expect(script).toContain(themeKey)
    expect(script).toContain('prefers-color-scheme')
    expect(script).toContain('data-theme')
    expect(script).toContain('"system"')
  })
})
