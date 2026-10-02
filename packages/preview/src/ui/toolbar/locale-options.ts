import type { SelectionInput } from '../../shared/contract'

export interface LocaleOption {
  value: string
  label: string
}

export function localeOptions(locales: readonly string[]): LocaleOption[] {
  return [
    { value: 'runtime', label: 'Locale da fixture' },
    ...locales.map((locale) => ({ value: `forced:${locale}`, label: locale })),
  ]
}

export function selectionToLocaleValue(selection: { mode: 'runtime' | 'forced'; forcedLocale: string | null }): string {
  if (selection.mode === 'forced' && selection.forcedLocale) return `forced:${selection.forcedLocale}`
  return 'runtime'
}

export function localeValueToSelection(value: string): SelectionInput {
  if (value.startsWith('forced:')) {
    const forcedLocale = value.slice('forced:'.length)
    if (forcedLocale.length > 0) return { mode: 'forced', forcedLocale }
  }
  return { mode: 'runtime', forcedLocale: null }
}
