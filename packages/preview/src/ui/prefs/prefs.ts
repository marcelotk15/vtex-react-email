import { viewportPresets, type ViewportPreset } from '../model/viewport'

export const prefsKey = 'vtex-email.preview.ui.v1'

export type InspectorTab = 'data' | 'source' | 'diagnostics'

export interface UiPrefs {
  sidebar: number
  sidebarOpen: boolean
  inspector: number
  inspectorOpen: boolean
  tab: InspectorTab
  viewport: ViewportPreset
  expanded: string[]
}

export interface PrefsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const defaultPrefs: UiPrefs = {
  sidebar: 248,
  sidebarOpen: true,
  inspector: 280,
  inspectorOpen: true,
  tab: 'data',
  viewport: 'desktop',
  expanded: [],
}

const tabs: readonly InspectorTab[] = ['data', 'source', 'diagnostics']

export function readPrefs(storage: PrefsStorage | null): UiPrefs {
  if (!storage) return { ...defaultPrefs, expanded: [] }
  const raw = storage.getItem(prefsKey)
  if (!raw) return { ...defaultPrefs, expanded: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...defaultPrefs, expanded: [] }
  }
  if (!parsed || typeof parsed !== 'object') return { ...defaultPrefs, expanded: [] }
  const record = parsed as Record<string, unknown>
  return {
    sidebar: clamp(record.sidebar, 200, 360, defaultPrefs.sidebar),
    sidebarOpen: typeof record.sidebarOpen === 'boolean' ? record.sidebarOpen : defaultPrefs.sidebarOpen,
    inspector: clamp(record.inspector, 160, 640, defaultPrefs.inspector),
    inspectorOpen: typeof record.inspectorOpen === 'boolean' ? record.inspectorOpen : defaultPrefs.inspectorOpen,
    tab: tabs.includes(record.tab as InspectorTab) ? (record.tab as InspectorTab) : defaultPrefs.tab,
    viewport: viewportPresets.includes(record.viewport as ViewportPreset)
      ? (record.viewport as ViewportPreset)
      : defaultPrefs.viewport,
    expanded: Array.isArray(record.expanded)
      ? record.expanded.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

export function writePrefs(storage: PrefsStorage | null, prefs: UiPrefs): void {
  if (!storage) return
  const stored: UiPrefs = {
    sidebar: clamp(prefs.sidebar, 200, 360, defaultPrefs.sidebar),
    sidebarOpen: prefs.sidebarOpen,
    inspector: clamp(prefs.inspector, 160, 640, defaultPrefs.inspector),
    inspectorOpen: prefs.inspectorOpen,
    tab: prefs.tab,
    viewport: prefs.viewport,
    expanded: prefs.expanded.filter((item) => item.length > 0),
  }
  storage.setItem(prefsKey, JSON.stringify(stored))
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}
