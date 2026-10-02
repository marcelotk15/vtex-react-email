import { errorDiagnostic, warningDiagnostic, type Diagnostic } from '@vtex-email/core'

const LIMIT = 'This check does not establish compatibility with email clients.'

const LIMITED = [
  { pattern: /display\s*:\s*flex\b/i, name: 'display:flex' },
  { pattern: /display\s*:\s*grid\b/i, name: 'display:grid' },
  { pattern: /position\s*:\s*(?:absolute|fixed)\b/i, name: 'position' },
  { pattern: /(?<![-\w])transform\s*:/i, name: 'transform' },
]

export function diagnoseStyles(html: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const rule of LIMITED) {
    if (rule.pattern.test(html)) {
      diagnostics.push(
        warningDiagnostic('CSS001', `Property "${rule.name}" has limited support in email clients. ${LIMIT}`),
      )
    }
  }
  const preserved = preservedClasses(html)
  const reported = new Set<string>()
  for (const match of html.matchAll(/class="([^"]*)"/g)) {
    for (const token of (match[1] ?? '').split(/\s+/)) {
      if (token.length === 0 || preserved.has(token) || reported.has(token)) continue
      reported.add(token)
      if (unprocessed(token)) {
        diagnostics.push(errorDiagnostic('CSS002', `Class "${token}" was not processed by the adapter. ${LIMIT}`))
      }
    }
  }
  return diagnostics
}

function preservedClasses(html: string): Set<string> {
  const names = new Set<string>()
  for (const block of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const selector of (block[1] ?? '').matchAll(/\.(-?[_a-zA-Z0-9-]+)/g)) {
      const name = selector[1]
      if (name) names.add(name)
    }
  }
  return names
}

function unprocessed(token: string): boolean {
  if (token.includes(':')) return true
  if (['flex', 'grid', 'absolute', 'fixed', 'relative', 'block', 'hidden'].includes(token)) return true
  return /^(?:m|p|w|h|text|bg|font|border|rounded|inline|items|justify|gap|max|min|sm|md|lg|hover|flex|grid)-/.test(
    token,
  )
}
