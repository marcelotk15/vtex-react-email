export interface DiagnosticSource {
  file: string
  line?: number
  column?: number
}

export interface Diagnostic {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  templateId?: string
  locale?: string
  fixtureId?: string
  origin?: string
  source?: DiagnosticSource
  path?: string
  suggestion?: string
}

export function errorDiagnostic(
  code: string,
  message: string,
  extra: Omit<Diagnostic, 'code' | 'severity' | 'message'> = {},
): Diagnostic {
  return { code, severity: 'error', message, ...extra }
}

export function warningDiagnostic(
  code: string,
  message: string,
  extra: Omit<Diagnostic, 'code' | 'severity' | 'message'> = {},
): Diagnostic {
  return { code, severity: 'warning', message, ...extra }
}
