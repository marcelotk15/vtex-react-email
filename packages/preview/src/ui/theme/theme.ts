export const themeKey = 'vtex-email.preview.theme.v1'

export type ThemePreference = 'white' | 'dark' | 'system'
export type ResolvedTheme = 'white' | 'dark'

export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const defaultThemePreference: ThemePreference = 'system'

const preferences: readonly ThemePreference[] = ['white', 'dark', 'system']

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && preferences.includes(value as ThemePreference)
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'white') return 'white'
  if (preference === 'dark') return 'dark'
  return systemDark ? 'dark' : 'white'
}

export function readThemePreference(storage: ThemeStorage | null): ThemePreference {
  if (!storage) return defaultThemePreference
  try {
    const raw = storage.getItem(themeKey)
    if (isThemePreference(raw)) return raw
  } catch {
    return defaultThemePreference
  }
  return defaultThemePreference
}

export function writeThemePreference(storage: ThemeStorage | null, preference: ThemePreference): void {
  if (!storage) return
  try {
    storage.setItem(themeKey, preference)
  } catch {
    // Storage may be unavailable (private mode, quota, policy).
  }
}

export function applyResolvedTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.dataset.theme = theme
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
}

export function readSystemDark(media: { matches: boolean } | null): boolean {
  return media?.matches === true
}

/** Inline boot fragment for the preview shell (no CSP on the host page). */
export function themeBootScript(): string {
  return `(function(){try{var k=${JSON.stringify(themeKey)};var v=localStorage.getItem(k);if(v!=="white"&&v!=="dark"&&v!=="system")v="system";var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=v==="white"?"white":v==="dark"?"dark":dark?"dark":"white";var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t==="dark"?"dark":"light"}catch(e){document.documentElement.setAttribute("data-theme","white");document.documentElement.style.colorScheme="light"}})();`
}
