const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const INDEX = /^[0-9]+$/
/** Handlebars segment literal (`[Tipo Documento]`): any text except brackets, braces, and control characters. */
function isLiteralSegment(segment: string): boolean {
  if (segment.length === 0) return false
  for (const char of segment) {
    if (char === '[' || char === ']' || char === '{' || char === '}' || char.charCodeAt(0) < 0x20) return false
  }
  return true
}

export type Expression =
  | { kind: 'path'; value: string }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'helper'; name: string; args: Expression[] }

export type PathResult = { ok: true; segments: string[]; emitted: string } | { ok: false; message: string }

export function parentHops(segments: readonly string[]): number {
  let hops = 0
  for (const segment of segments) {
    if (segment !== '..') break
    hops += 1
  }
  return hops
}

export function parsePath(input: string, allowParent: boolean): PathResult {
  if (input.length === 0) return { ok: false, message: 'Empty path.' }
  if (input === '@index') {
    return { ok: true, segments: ['@index'], emitted: '@index' }
  }
  if (input.includes('@')) {
    return { ok: false, message: `Unsupported path syntax: ${input}` }
  }
  const segments: string[] = []
  let cursor = 0

  while (input.startsWith('../', cursor)) {
    if (!allowParent) return { ok: false, message: 'The profile does not allow the ../ segment.' }
    segments.push('..')
    cursor += 3
  }

  if (cursor < input.length) {
    const rest = input.slice(cursor)
    if (rest.length === 0) return { ok: false, message: 'Incomplete path.' }
    const split = splitSegments(rest)
    if (!split.ok) return { ok: false, message: `${split.message}: ${input}` }
    for (const { segment, literal } of split.segments) {
      if (literal) {
        if (!isLiteralSegment(segment) || segment.trim() !== segment || segment === '.' || segment === '..') {
          return { ok: false, message: `Unsupported path segment: [${segment}]` }
        }
      } else if (!IDENTIFIER.test(segment) && !INDEX.test(segment)) {
        return { ok: false, message: `Unsupported path segment: ${segment}` }
      }
      if (FORBIDDEN_SEGMENTS.has(segment) || segment === 'this') {
        return { ok: false, message: `Rejected path segment: ${segment}` }
      }
      segments.push(segment)
    }
  }

  if (segments.every((segment) => segment === '..')) {
    return { ok: false, message: 'Path has no property.' }
  }

  return { ok: true, segments, emitted: emitPath(segments) }
}

function splitSegments(
  rest: string,
): { ok: true; segments: Array<{ segment: string; literal: boolean }> } | { ok: false; message: string } {
  const segments: Array<{ segment: string; literal: boolean }> = []
  let cursor = 0
  while (cursor <= rest.length) {
    if (rest[cursor] === '[') {
      const close = rest.indexOf(']', cursor + 1)
      if (close < 0) return { ok: false, message: 'Unclosed segment literal' }
      segments.push({ segment: rest.slice(cursor + 1, close), literal: true })
      cursor = close + 1
    } else {
      let end = rest.indexOf('.', cursor)
      if (end < 0) end = rest.length
      const segment = rest.slice(cursor, end)
      if (segment.includes('[') || segment.includes(']')) return { ok: false, message: 'Misplaced segment literal' }
      segments.push({ segment, literal: false })
      cursor = end
    }
    if (cursor === rest.length) break
    if (rest[cursor] !== '.') return { ok: false, message: 'Expected "." after a segment literal' }
    cursor += 1
    if (cursor === rest.length) return { ok: false, message: 'Incomplete path' }
  }
  return { ok: true, segments }
}

/** Identifiers and indexes are emitted bare; any other key needs the Handlebars segment literal. */
function emitSegment(segment: string): string {
  return IDENTIFIER.test(segment) || INDEX.test(segment) ? segment : `[${segment}]`
}

export function emitPath(segments: readonly string[]): string {
  let output = ''
  for (const raw of segments) {
    const segment = raw === '..' || raw === '@index' ? raw : emitSegment(raw)
    if (raw === '..') {
      output += output.length === 0 ? '..' : '/..'
    } else if (output.length === 0) {
      output = segment
    } else if (output.endsWith('..')) {
      output += `/${segment}`
    } else {
      output += `.${segment}`
    }
  }
  return output
}
