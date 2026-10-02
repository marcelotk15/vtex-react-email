import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  applyResolvedTheme,
  readSystemDark,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
  type ThemeStorage,
} from './theme'

const ThemeContext = createContext<{
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
} | null>(null)

function systemMedia(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia('(prefers-color-scheme: dark)')
}

export function ThemeProvider({ storage, children }: { storage: ThemeStorage | null; children: ReactNode }) {
  const [preference, setPreferenceState] = useState(() => readThemePreference(storage))
  const [systemEpoch, setSystemEpoch] = useState(0)

  useEffect(() => {
    if (preference !== 'system') return
    const media = systemMedia()
    if (!media) return
    const onChange = () => setSystemEpoch((value) => value + 1)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const resolved = resolveTheme(preference, readSystemDark(systemMedia()))
  void systemEpoch

  useEffect(() => {
    applyResolvedTheme(document.documentElement, resolved)
  }, [resolved])

  const value = useMemo(
    () => ({
      preference,
      resolved,
      setPreference(next: ThemePreference) {
        setPreferenceState(next)
        writeThemePreference(storage, next)
      },
    }),
    [preference, resolved, storage],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
} {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('Preview theme is missing.')
  return value
}
