import type { Diagnostic } from '../diagnostics'

import { errorDiagnostic } from '../diagnostics'
import { compileOptions, createHandlebars, handlebarsDiagnostic } from '../hbs/engine'

export function validateHandlebarsSyntax(source: string, knownHelperNames: readonly string[]): Diagnostic | null {
  const instance = createHandlebars()
  try {
    const generated = instance.precompile(source, compileOptions(knownHelperNames))
    if (typeof generated !== 'string') {
      return errorDiagnostic('HBS001', 'Handlebars precompilation did not return source text.')
    }
  } catch (error) {
    return handlebarsDiagnostic(error)
  }
  return null
}
