import { z } from 'zod'

import { errorDiagnostic, type Diagnostic } from '../diagnostics'
import { schemaMutates } from '../schema/zod-def'

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

export { schemaMutates }
