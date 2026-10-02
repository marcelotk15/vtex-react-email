import { viewportPresets, type ViewportPreset } from '../model/viewport'

export const prefsKey = 'vtex-email.preview.ui.v2'
const legacyPrefsKey = 'vtex-email.preview.ui.v1'

export type InspectorTab = 'data' | 'source'
export type PropertiesTab = 'properties' | 'diagnostics'

export interface UiPrefs {
  sidebar: number
  sidebarOpen: boolean
  properties: number
  propertiesOpen: boolean
  propertiesTab: PropertiesTab
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
  properties: 280,
  propertiesOpen: true,
  propertiesTab: 'properties',
  inspector: 280,
  inspectorOpen: true,
  tab: 'data',
  viewport: 'desktop',
  expanded: [],
}

const inspectorTabs: readonly InspectorTab[] = ['data', 'source']
const propertiesTabs: readonly PropertiesTab[] = ['properties', 'diagnostics']

export function readPrefs(storage: PrefsStorage | null): UiPrefs {
  if (!storage) return { ...defaultPrefs, expanded: [] }
  const raw = storage.getItem(prefsKey) ?? storage.getItem(legacyPrefsKey)
  if (!raw) return { ...defaultPrefs, expanded: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...defaultPrefs, expanded: [] }
  }
  if (!parsed || typeof parsed !== 'object') return { ...defaultPrefs, expanded: [] }
  const record = parsed as Record<string, unknown>
  const legacyTab = record.tab
  const migratedDiagnostics = legacyTab === 'diagnostics'
  const tab =
    inspectorTabs.includes(legacyTab as InspectorTab)
      ? (legacyTab as InspectorTab)
      : defaultPrefs.tab
  const propertiesTab = propertiesTabs.includes(record.propertiesTab as PropertiesTab)
    ? (record.propertiesTab as PropertiesTab)
    : migratedDiagnostics
      ? 'diagnostics'
      : defaultPrefs.propertiesTab
  return {
    sidebar: clamp(record.sidebar, 200, 360, defaultPrefs.sidebar),
    sidebarOpen: typeof record.sidebarOpen === 'boolean' ? record.sidebarOpen : defaultPrefs.sidebarOpen,
    properties: clamp(record.properties, 220, 420, defaultPrefs.properties),
    propertiesOpen:
      typeof record.propertiesOpen === 'boolean' ? record.propertiesOpen : defaultPrefs.propertiesOpen,
    propertiesTab,
    inspector: clamp(record.inspector, 160, 640, defaultPrefs.inspector),
    inspectorOpen: typeof record.inspectorOpen === 'boolean' ? record.inspectorOpen : defaultPrefs.inspectorOpen,
    tab,
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
    properties: clamp(prefs.properties, 220, 420, defaultPrefs.properties),
    propertiesOpen: prefs.propertiesOpen,
    propertiesTab: prefs.propertiesTab,
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
