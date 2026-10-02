export const viewportPresets = ['mobile', 'desktop', 'wide', 'fit'] as const

export type ViewportPreset = (typeof viewportPresets)[number]

export interface ViewportChoice {
  id: ViewportPreset
  label: string
  width: number | null
  height: number | null
}

export const viewportChoices: readonly ViewportChoice[] = [
  { id: 'mobile', label: 'Mobile', width: 375, height: 667 },
  { id: 'desktop', label: 'Desktop', width: 600, height: null },
  { id: 'wide', label: 'Wide', width: 1024, height: null },
  { id: 'fit', label: 'Fit', width: null, height: null },
]

export function viewportChoice(id: string): ViewportChoice {
  const desktop = viewportChoices[1]
  for (const item of viewportChoices) if (item.id === id) return item
  if (!desktop) return { id: 'desktop', label: 'Desktop', width: 600, height: null }
  return desktop
}
