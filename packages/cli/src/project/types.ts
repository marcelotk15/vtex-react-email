import type { Diagnostic, EmailDefinition, EmissionProfile, LocalSimulator, ScopeNode } from '@vtex-email/core'
import type { BuildManifest } from '@vtex-email/react'
import type { ZodType } from 'zod'

export const exitOk = 0
export const exitValidation = 1
export const exitUsage = 2

export interface FixtureMeta {
  description: string
  origin: string
  event: string
  purpose: string
  expectedLocale?: string
  expect: 'valid' | 'invalid'
}

export interface LoadedFixture {
  id: string
  file: string
  data: unknown
  meta: FixtureMeta
  negative: boolean
}

export interface BuiltFile {
  name: string
  content: string
  sha256: string
  role: 'locale' | 'merged'
  locale?: string
}

export interface LoadedProfile {
  emission: EmissionProfile
  simulator: LocalSimulator
}

export interface BuiltEmail {
  id: string
  event: string
  output: 'per-locale' | 'merged'
  locales: string[]
  defaultLocale: string
  localePath: string
  files: BuiltFile[]
  diagnostics: Diagnostic[]
  structure: ScopeNode[]
  dependencies: string[]
  fixtures: LoadedFixture[]
  fixturesPattern: string
  file: string
  schema: ZodType
  manifest: BuildManifest | null
  profile: LoadedProfile
  warnRenderedBytes: number
}

export interface ProjectManifest {
  formatVersion: 1
  profileId: string
  homologation: 'experimental'
  emails: Array<{
    id: string
    event: string
    output: 'per-locale' | 'merged'
    locales: string[]
    defaultLocale: string
    files: Array<{ name: string; sha256: string; role: 'locale' | 'merged'; locale?: string }>
    capabilities: Array<{ name: string; evidence: string }>
    warnings: string[]
  }>
}

export interface ProjectResult {
  ok: boolean
  exitCode: 0 | 1 | 2
  diagnostics: Diagnostic[]
  manifest: ProjectManifest | null
  emails: BuiltEmail[]
  wrote: string[]
  preserved: string[]
  removedEmailIds?: string[]
}

export interface PreviewResult {
  ok: boolean
  exitCode: 0 | 1 | 2
  html: string
  source: string
  diagnostics: Diagnostic[]
  selector: boolean
  locale: string
  payloadLocale: string | null
}

export interface ResolvedEmail {
  definition: EmailDefinition<() => unknown>
  file: string
  dependencies: string[]
  locales: string[]
  defaultLocale: string
  localePath: string
  output: 'per-locale' | 'merged'
  aliases: Array<{ alias: string; locale: string }>
  unknownPath: 'error' | 'warning'
  warningsAsErrors: boolean
  unverifiedCapability: 'error' | 'warning'
}

export function emptyProject(exitCode: 1 | 2, diagnostics: Diagnostic[]): ProjectResult {
  return { ok: false, exitCode, diagnostics, manifest: null, emails: [], wrote: [], preserved: [] }
}
