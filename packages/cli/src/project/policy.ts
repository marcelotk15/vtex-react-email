import type { Diagnostic } from '@vtex-email/core'

import type { ResolvedEmail } from './types'

export function applyPolicy(diagnostics: Diagnostic[], email: ResolvedEmail): Diagnostic[] {
  return diagnostics.map((issue) => {
    let severity = issue.severity
    if (issue.code === 'PATH001' && email.unknownPath === 'warning') severity = 'warning'
    if (issue.code === 'TARGET001' && email.unverifiedCapability === 'error') severity = 'error'
    if (severity === 'warning' && email.warningsAsErrors) severity = 'error'
    return severity === issue.severity ? issue : { ...issue, severity }
  })
}
