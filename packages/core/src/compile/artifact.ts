import { createHash } from 'node:crypto'

import type { Diagnostic } from '../diagnostics'
import type { ScopeNode } from '../scope/structure'

export interface BuildManifest {
  formatVersion: 1
  templateId: string
  event: string
  profileId: string
  locales: string[]
  defaultLocale: string
  sha256: string
  capabilities: Array<{ name: string; evidence: string; note: string }>
  homologation: 'experimental'
  warnings: string[]
}

export interface CompiledArtifact {
  name: string
  content: string
  sha256: string
}

export type CompileEmailResult =
  | {
      ok: true
      artifacts: CompiledArtifact[]
      manifest: BuildManifest
      diagnostics: Diagnostic[]
      structure: ScopeNode[]
    }
  | { ok: false; diagnostics: Diagnostic[] }

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export function normalizeOutput(content: string): string {
  const normalized = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  if (normalized.includes('\r')) throw new Error('Output still contains CR.')
  return normalized
}
