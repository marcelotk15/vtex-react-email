import { createHash } from 'node:crypto'

import { errorDiagnostic, type Diagnostic } from './diagnostics'
import { parseMessage, placeholderSignature } from './message'
import { opaqueTokenIssue } from './tokens'

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export function checkCatalogs(
  locales: readonly string[],
  catalogs: Readonly<Record<string, Readonly<Record<string, string>>>>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const first = catalogs[locales[0] ?? '']
  const expected = first ? Object.keys(first).sort().join('\0') : ''

  for (const locale of locales) {
    const catalog = catalogs[locale]
    if (!catalog) {
      diagnostics.push(errorDiagnostic('I18N001', `Missing catalog for ${locale}.`, { locale }))
      continue
    }
    if (Object.keys(catalog).sort().join('\0') !== expected) {
      diagnostics.push(
        errorDiagnostic('I18N001', `Catalog keys for ${locale} differ from the other locales.`, { locale }),
      )
    }
    for (const [key, value] of Object.entries(catalog)) {
      const parsed = parseMessage(value)
      if (!parsed.ok || opaqueTokenIssue(value)) {
        diagnostics.push(
          errorDiagnostic('I18N001', `Translation ${key} contains delimiters that are not allowed.`, { locale }),
        )
      }
    }
    if (first) {
      for (const key of Object.keys(first)) {
        const current = catalog[key]
        const original = first[key]
        if (current === undefined || original === undefined) continue
        const left = placeholderSignature(original)
        const right = placeholderSignature(current)
        if (left !== null && right !== null && left !== right) {
          diagnostics.push(errorDiagnostic('I18N001', `Placeholders for ${key} differ between locales.`, { locale }))
        }
      }
    }
  }

  return diagnostics
}
