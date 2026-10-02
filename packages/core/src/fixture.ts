import { z } from 'zod'

import { errorDiagnostic, type Diagnostic } from './diagnostics'

const MUTATING = new Set(['transform', 'default', 'prefault', 'catch', 'pipe'])

export function checkFixture(schema: z.ZodType, data: unknown): Diagnostic | null {
  if (schemaMutates(schema)) {
    return errorDiagnostic('DATA001', 'Schema applies coercion, a default, or a transform.')
  }
  const before = JSON.stringify(data)
  const copy = structuredClone(data)
  const parsed = schema.safeParse(copy)
  if (JSON.stringify(data) !== before) {
    return errorDiagnostic('DATA001', 'Validation changed the fixture.')
  }
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join('; ')
    return errorDiagnostic('DATA001', message || 'Fixture is outside the contract.')
  }
  return null
}

export function schemaMutates(schema: unknown): boolean {
  const seen = new Set<unknown>()
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object' || seen.has(node)) return false
    seen.add(node)
    const def = (node as { def?: { type?: string; coerce?: boolean } }).def
    if (!def || typeof def !== 'object') return false
    if (def.coerce === true || (typeof def.type === 'string' && MUTATING.has(def.type))) return true
    for (const value of Object.values(def)) {
      if (Array.isArray(value)) {
        if (value.some((item) => visit(item))) return true
        continue
      }
      if (value && typeof value === 'object') {
        if ('def' in value) {
          if (visit(value)) return true
          continue
        }
        if (Object.values(value).some((item) => visit(item))) return true
      }
    }
    return false
  }
  return visit(schema)
}
