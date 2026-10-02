import { parsePath } from './emit'

export function withForcedLocale(
  data: unknown,
  localePath: string,
  locale: string,
): { ok: true; data: unknown } | { ok: false; message: string } {
  const copy: unknown = structuredClone(data)
  const parsed = parsePath(localePath, false)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  let cursor: unknown = copy
  const segments = parsed.segments
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]
    if (!key || cursor === null || typeof cursor !== 'object')
      return { ok: false, message: `Cannot set ${localePath}.` }
    const record = cursor as Record<string, unknown>
    const next = record[key]
    if (next === undefined || next === null) {
      const upcoming = segments[index + 1] ?? ''
      record[key] = /^[0-9]+$/.test(upcoming) ? [] : {}
    }
    cursor = record[key]
  }
  const last = segments[segments.length - 1]
  if (!last || cursor === null || typeof cursor !== 'object') return { ok: false, message: `Cannot set ${localePath}.` }
  ;(cursor as Record<string, unknown>)[last] = locale
  return { ok: true, data: copy }
}
