const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

type Token =
  | { kind: 'open'; raw: string; name: string }
  | { kind: 'close'; raw: string; name: string }
  | { kind: 'void'; raw: string }
  | { kind: 'hbs-open'; raw: string }
  | { kind: 'hbs-close'; raw: string }
  | { kind: 'hbs-mid'; raw: string }
  | { kind: 'inline'; raw: string }

export function formatHandlebarsSource(source: string, indentUnit = '  '): string {
  if (source.length === 0) return source
  const tokens = tokenize(source)
  if (tokens.length === 0) return source

  const lines: string[] = []
  let depth = 0
  let inline = ''

  const flushInline = () => {
    const text = inline.replace(/\s+/g, ' ').trim()
    inline = ''
    if (text.length === 0) return
    lines.push(`${indentUnit.repeat(depth)}${text}`)
  }

  for (const token of tokens) {
    if (token.kind === 'inline') {
      inline += token.raw
      continue
    }

    flushInline()

    if (token.kind === 'close' || token.kind === 'hbs-close') {
      depth = Math.max(0, depth - 1)
      lines.push(`${indentUnit.repeat(depth)}${token.raw}`)
      continue
    }

    if (token.kind === 'hbs-mid') {
      lines.push(`${indentUnit.repeat(Math.max(0, depth - 1))}${token.raw}`)
      continue
    }

    lines.push(`${indentUnit.repeat(depth)}${token.raw}`)
    if (token.kind === 'open' || token.kind === 'hbs-open') depth += 1
  }

  flushInline()
  return lines.join('\n')
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    if (source.startsWith('{{', index)) {
      const end = findMustacheEnd(source, index)
      if (end < 0) {
        tokens.push({ kind: 'inline', raw: source.slice(index) })
        break
      }
      const raw = source.slice(index, end)
      tokens.push(classifyMustache(raw))
      index = end
      continue
    }

    if (source[index] === '<') {
      const end = findTagEnd(source, index)
      if (end < 0) {
        tokens.push({ kind: 'inline', raw: source.slice(index) })
        break
      }
      const raw = source.slice(index, end)
      tokens.push(classifyTag(raw))
      index = end
      continue
    }

    const next = nextMarkup(source, index)
    tokens.push({ kind: 'inline', raw: source.slice(index, next) })
    index = next
  }

  return tokens
}

function nextMarkup(source: string, from: number): number {
  const tag = source.indexOf('<', from)
  const mustache = source.indexOf('{{', from)
  if (tag < 0 && mustache < 0) return source.length
  if (tag < 0) return mustache
  if (mustache < 0) return tag
  return Math.min(tag, mustache)
}

function findMustacheEnd(source: string, from: number): number {
  const triple = source.startsWith('{{{', from)
  const close = triple ? '}}}' : '}}'
  const at = source.indexOf(close, from + (triple ? 3 : 2))
  return at < 0 ? -1 : at + close.length
}

function findTagEnd(source: string, from: number): number {
  let quote: '"' | "'" | null = null
  for (let index = from + 1; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '>') return index + 1
  }
  return -1
}

function classifyMustache(raw: string): Token {
  const body = raw
    .replace(/^\{\{\{?~?/, '')
    .replace(/~?\}\}\}?$/, '')
    .trim()
  if (body.startsWith('!') || body.startsWith('--')) return { kind: 'inline', raw }
  if (body.startsWith('/') || body.startsWith('^/')) return { kind: 'hbs-close', raw }
  if (/^else\b/i.test(body)) return { kind: 'hbs-mid', raw }
  if (body.startsWith('#') || body.startsWith('^')) return { kind: 'hbs-open', raw }
  return { kind: 'inline', raw }
}

function classifyTag(raw: string): Token {
  if (raw.startsWith('<!--') || raw.startsWith('<!') || raw.startsWith('<?')) return { kind: 'void', raw }
  const close = /^<\/\s*([a-zA-Z0-9:-]+)/.exec(raw)
  if (close?.[1]) return { kind: 'close', raw, name: close[1].toLowerCase() }
  const open = /^<\s*([a-zA-Z0-9:-]+)/.exec(raw)
  if (!open?.[1]) return { kind: 'void', raw }
  const name = open[1].toLowerCase()
  if (VOID_TAGS.has(name) || raw.endsWith('/>')) return { kind: 'void', raw }
  return { kind: 'open', raw, name }
}
