import { errorDiagnostic, type Diagnostic } from '@vtex-email/core'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { ResolvedConfig } from '../config/config'

export async function readCatalogs(
  config: ResolvedConfig,
  locales: readonly string[],
  diagnostics: Diagnostic[],
): Promise<Record<string, Record<string, string>>> {
  const catalogs: Record<string, Record<string, string>> = {}
  for (const locale of locales) {
    const relative = config.catalogs.replaceAll('{locale}', locale)
    const file = path.resolve(config.configDir, relative)
    try {
      const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
      if (!isFlatCatalog(parsed)) {
        diagnostics.push(errorDiagnostic('I18N001', `Catalog ${locale} must be a flat string map.`, { locale }))
        continue
      }
      catalogs[locale] = parsed
    } catch (error) {
      const message = error instanceof Error ? error.message : `Missing catalog for ${locale}.`
      diagnostics.push(errorDiagnostic('I18N001', message, { locale }))
    }
  }
  return catalogs
}

function isFlatCatalog(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((item) => typeof item === 'string')
}
