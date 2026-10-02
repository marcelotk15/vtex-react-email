import type { Diagnostic, Failure } from '../diagnostics'
import type { SiteRecord } from '../markers/sites'
import type { Marker } from '../markers/tokens'
import type { EmissionCapability, EmissionProfile } from '../profile'

import { bindSites } from '../markers/bind'
import { restoreHandlebars } from '../markers/restore'
import { syntaxHelperNames } from '../profile'
import { normalizeOutput, sha256, type BuildManifest, type CompileEmailResult } from './artifact'
import { validateHandlebarsSyntax } from './syntax'
import { unverifiedCapabilityDiagnostic } from './target'

export interface AssembleDocumentInput {
  html: string
  markers: ReadonlyMap<string, Marker>
  sites: ReadonlyMap<string, SiteRecord>
  profile: EmissionProfile
  templateId: string
  event: string
  locale: string
}

export function assembleDocument(input: AssembleDocumentInput): CompileEmailResult {
  const bound = bindSites(input.html, input.markers, input.sites, input.profile)
  if (!bound.ok) return fail(stamp(bound.diagnostics, input))
  const restored = restoreHandlebars(input.html, bound.markers)
  if (!restored.ok) return fail(stamp(restored.diagnostics, input))

  const content = normalizeOutput(restored.html)
  const syntax = validateHandlebarsSyntax(content, syntaxHelperNames(input.profile))
  if (syntax) return fail([{ ...syntax, templateId: input.templateId, locale: input.locale }])

  const diagnostics = targetWarnings(bound.used, input.templateId)
  const digest = sha256(content)
  const manifest: BuildManifest = {
    formatVersion: 1,
    templateId: input.templateId,
    event: input.event,
    profileId: input.profile.id,
    locales: [input.locale],
    defaultLocale: input.locale,
    sha256: digest,
    capabilities: bound.used.map((capability) => ({
      name: capability.name,
      evidence: capability.evidence,
      note: capability.note,
    })),
    homologation: 'experimental',
    warnings: diagnostics.map((issue) => issue.message),
  }
  return {
    ok: true,
    artifacts: [{ name: `${input.templateId}.html`, content, sha256: digest }],
    diagnostics,
    manifest,
    structure: bound.structure,
  }
}

function targetWarnings(used: readonly EmissionCapability[], templateId: string): Diagnostic[] {
  return used.flatMap((capability) => {
    const issue = unverifiedCapabilityDiagnostic(capability, templateId)
    return issue ? [issue] : []
  })
}

function stamp(diagnostics: readonly Diagnostic[], input: AssembleDocumentInput): Diagnostic[] {
  return diagnostics.map((issue) => ({ ...issue, templateId: input.templateId, locale: input.locale }))
}

function fail(diagnostics: Diagnostic[]): Failure {
  return { ok: false, diagnostics }
}
