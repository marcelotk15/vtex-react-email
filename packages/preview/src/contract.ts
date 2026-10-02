export interface PreviewDiagnostic {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  templateId?: string
  locale?: string
  fixtureId?: string
  path?: string
  origin?: string
  source?: { file: string; line?: number; column?: number }
}

export interface PreviewFixture {
  id: string
  description: string
  origin: string
  purpose: string
  file: string
  expectedLocale?: string
}

export interface PreviewEmail {
  id: string
  locales: string[]
  localePath: string
  fixtures: PreviewFixture[]
}

export interface PreviewSelection {
  emailId: string
  fixtureId: string
  mode: 'runtime' | 'forced'
  payloadLocale: string | null
  forcedLocale: string | null
}

export interface PreviewState {
  formatVersion: 1
  status: 'compiling' | 'ready' | 'stale'
  generation: number
  project: { name: string }
  emails: PreviewEmail[]
  selection: PreviewSelection
  html: string
  source: string
  selector: boolean
  data: unknown
  diagnostics: PreviewDiagnostic[]
}

export interface SelectionInput {
  emailId?: string
  fixtureId?: string
  mode?: 'runtime' | 'forced'
  forcedLocale?: string | null
}
