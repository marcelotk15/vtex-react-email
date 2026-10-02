export interface TextPart {
  type: 'text'
  value: string
}

export interface PlaceholderPart {
  type: 'placeholder'
  name: string
}

export type MessagePart = TextPart | PlaceholderPart

export type ParsedMessage = { ok: true; parts: MessagePart[]; placeholders: string[] } | { ok: false; message: string }

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g

export function parseMessage(value: string): ParsedMessage {
  if (value.includes('{{') || value.includes('}}')) {
    return { ok: false, message: 'Message contains Handlebars delimiters.' }
  }
  const parts: MessagePart[] = []
  const placeholders: string[] = []
  let cursor = 0
  for (const match of value.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0
    const name = match[1]
    if (!name) return { ok: false, message: 'Invalid placeholder.' }
    const text = value.slice(cursor, index)
    if (text.includes('{') || text.includes('}')) return { ok: false, message: 'Invalid placeholder.' }
    if (text.length > 0) parts.push({ type: 'text', value: text })
    parts.push({ type: 'placeholder', name })
    placeholders.push(name)
    cursor = index + match[0].length
  }
  const rest = value.slice(cursor)
  if (rest.includes('{') || rest.includes('}')) return { ok: false, message: 'Invalid placeholder.' }
  if (rest.length > 0) parts.push({ type: 'text', value: rest })
  if (new Set(placeholders).size !== placeholders.length) {
    return { ok: false, message: 'A placeholder is repeated in the message.' }
  }
  return { ok: true, parts, placeholders }
}

export function placeholderSignature(value: string): string | null {
  const parsed = parseMessage(value)
  if (!parsed.ok) return null
  return parsed.placeholders.slice().sort().join('\0')
}
