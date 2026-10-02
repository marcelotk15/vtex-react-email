import { emitBlockClose, emitBlockOpen, emitLiteral, parsePath } from './emit'

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

export function singleDocumentIssue(html: string): string | null {
  const counts = {
    doctype: countNeedle(html, '<!doctype'),
    html: countTag(html, 'html'),
    head: countTag(html, 'head'),
    body: countTag(html, 'body'),
  }
  if (counts.doctype === 1 && counts.html === 1 && counts.head === 1 && counts.body === 1) return null
  return `Resolved document has structure ${JSON.stringify(counts)}.`
}

function countNeedle(html: string, needle: string): number {
  const source = html.toLowerCase()
  const target = needle.toLowerCase()
  let count = 0
  let index = 0
  while (index < source.length) {
    const found = source.indexOf(target, index)
    if (found === -1) break
    count += 1
    index = found + target.length
  }
  return count
}

function countTag(html: string, tag: string): number {
  const source = html.toLowerCase()
  const target = `<${tag.toLowerCase()}`
  let count = 0
  let index = 0
  while (index < source.length) {
    const found = source.indexOf(target, index)
    if (found === -1) break
    const next = source[found + target.length]
    if (next === '>' || next === ' ' || next === '/' || next === '\n' || next === '\r' || next === '\t') count += 1
    index = found + target.length
  }
  return count
}
