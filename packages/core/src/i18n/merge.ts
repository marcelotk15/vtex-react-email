import { parsePath } from '../expression/path'
import { emitBlockClose, emitBlockOpen, emitLiteral } from '../hbs/source'

export function mergeLocaleDocuments(input: {
  localePath: string
  defaultLocale: string
  documents: ReadonlyArray<{ locale: string; html: string }>
  aliases?: ReadonlyArray<{ alias: string; locale: string }>
  equality?: string
}): string {
  if (input.documents.length === 0) throw new Error('Nothing to merge.')
  const byLocale = new Map(input.documents.map((document) => [document.locale, document.html]))
  const fallback = byLocale.get(input.defaultLocale)
  if (!fallback) throw new Error('The default locale must be present in the list.')
  const branches: Array<{ literal: string; html: string }> = []
  for (const document of input.documents) {
    if (document.locale === input.defaultLocale) continue
    branches.push({ literal: document.locale, html: document.html })
  }
  for (const alias of input.aliases ?? []) {
    const html = byLocale.get(alias.locale)
    if (!html) throw new Error(`Alias ${alias.alias} points at an unknown locale.`)
    branches.push({ literal: alias.alias, html })
  }
  if (branches.length === 0) return fallback
  const path = parsePath(input.localePath, true)
  if (!path.ok) throw new Error(path.message)
  const equality = input.equality ?? 'eq'
  let body = fallback
  for (let index = branches.length - 1; index >= 0; index -= 1) {
    const branch = branches[index]
    if (!branch) continue
    body = [
      emitBlockOpen(equality, [path.emitted, emitLiteral(branch.literal)]),
      branch.html,
      '{{else}}',
      body,
      emitBlockClose(equality),
    ].join('\n')
  }
  return `${body}\n`
}
