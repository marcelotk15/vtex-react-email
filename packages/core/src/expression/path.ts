const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const INDEX = /^[0-9]+$/

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
  if (input.includes('@') || input.includes('[') || input.includes(']')) {
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
    for (const segment of rest.split('.')) {
      if (!IDENTIFIER.test(segment) && !INDEX.test(segment)) {
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

export function emitPath(segments: readonly string[]): string {
  let output = ''
  for (const segment of segments) {
    if (segment === '..') {
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
