import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { readPrefs, writePrefs, type PrefsStorage, type UiPrefs } from './prefs'

const PrefsContext = createContext<{
  prefs: UiPrefs
  update: (patch: Partial<UiPrefs>) => void
} | null>(null)

export function PrefsProvider({ storage, children }: { storage: PrefsStorage | null; children: ReactNode }) {
  const [prefs, setPrefs] = useState(() => readPrefs(storage))
  const value = useMemo(
    () => ({
      prefs,
      update(patch: Partial<UiPrefs>) {
        setPrefs((current) => {
          const next = { ...current, ...patch }
          writePrefs(storage, next)
          return next
        })
      },
    }),
    [prefs, storage],
  )
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): { prefs: UiPrefs; update: (patch: Partial<UiPrefs>) => void } {
  const value = useContext(PrefsContext)
  if (!value) throw new Error('Preview preferences are missing.')
  return value
}
