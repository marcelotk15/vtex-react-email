import { createHash } from 'node:crypto'

export const TOKEN_PREFIX = 'vtx'
export const TOKEN_BODY_LENGTH = 20
export const TOKEN_LENGTH = TOKEN_PREFIX.length + TOKEN_BODY_LENGTH

const HEX_CHAR = /^[0-9a-f]$/i
const ALPHA_NUM = /^[0-9A-Za-z]$/

export interface TextMarker {
  kind: 'text'
  replacement: string
}

export interface AttrMarker {
  kind: 'attr'
  attribute: 'href' | 'src' | 'alt' | 'title'
  replacement: string
}

export interface OpenMarker {
  kind: 'open'
  open: string
  close: string
  elseId: string | null
}

export interface ElseMarker {
  kind: 'else'
  openId: string
}

export type Marker = TextMarker | AttrMarker | OpenMarker | ElseMarker

export function mintToken(parts: { kind: string; index: number; path: string; detail: string }): string {
  const payload = `${parts.kind}\n${parts.index}\n${parts.path}\n${parts.detail}`
  const body = createHash('sha256').update(payload).digest('hex').slice(0, TOKEN_BODY_LENGTH)
  return `${TOKEN_PREFIX}${body}`
}

export interface TokenScan {
  ok: true
  counts: Map<string, number>
}

export interface TokenScanFailure {
  ok: false
  message: string
  index: number
}

function isHexChar(value: string | undefined): boolean {
  return value !== undefined && HEX_CHAR.test(value)
}

function isAlphaNum(value: string | undefined): boolean {
  return value !== undefined && ALPHA_NUM.test(value)
}

export function scanTokens(html: string, markers: ReadonlyMap<string, Marker>): TokenScan | TokenScanFailure {
  const counts = new Map<string, number>()
  let cursor = 0

  while (cursor < html.length) {
    const at = html.indexOf(TOKEN_PREFIX, cursor)
    if (at === -1) break
    const before = at > 0 ? html[at - 1] : undefined
    let hexEnd = at + TOKEN_PREFIX.length
    while (isHexChar(html[hexEnd])) hexEnd += 1
    const hexLength = hexEnd - (at + TOKEN_PREFIX.length)

    if (isHexChar(before)) {
      if (hexLength > 0) {
        return invalid(at, html)
      }
      cursor = at + TOKEN_PREFIX.length
      continue
    }

    if (hexLength === TOKEN_BODY_LENGTH) {
      const candidate = html.slice(at, at + TOKEN_LENGTH)
      if (!markers.has(candidate)) return invalid(at, html)
      counts.set(candidate, (counts.get(candidate) ?? 0) + 1)
      cursor = at + TOKEN_LENGTH
      continue
    }

    if (hexLength > 0 || isAlphaNum(html[at + TOKEN_PREFIX.length])) {
      return invalid(at, html)
    }

    cursor = at + TOKEN_PREFIX.length
  }

  for (const [id, marker] of markers) {
    const seen = counts.get(id) ?? 0
    const allowed = marker.kind === 'attr' ? seen >= 1 : seen === 1
    if (!allowed) {
      return {
        ok: false,
        index: html.indexOf(id),
        message: `Marker ${id} appears ${seen} time(s); the proof allows one occurrence.`,
      }
    }
  }

  return { ok: true, counts }
}

export function opaqueTokenIssue(text: string): string | null {
  const scanned = scanTokens(text, new Map())
  return scanned.ok ? null : scanned.message
}

function invalid(index: number, html: string): TokenScanFailure {
  return {
    ok: false,
    index,
    message: `Invalid opaque marker near ${html.slice(index, index + 32)}`,
  }
}
