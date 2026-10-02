import { render, type TailwindConfig } from '@react-email/components'
import {
  bindSites,
  checkCatalogs,
  errorDiagnostic,
  isSafeEmailId,
  normalizeOutput,
  restoreHandlebars,
  sha256,
  syntaxHelperNames,
  validateHandlebarsSyntax,
  warningDiagnostic,
  type Diagnostic,
  type EmailDocument,
  type EmissionCapability,
  type EmissionProfile,
  type ScopeNode,
} from '@vtex-email/core'
import { createElement, type ReactNode } from 'react'

import { CompileAborted, createSession, runSession } from './session'

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

export interface CompileEmailInput {
  email: EmailDocument<() => ReactNode>
  locale: string
  catalog: Readonly<Record<string, string>>
  profile: EmissionProfile
  tailwind: TailwindConfig
  file?: string
}

export async function compileEmail(input: CompileEmailInput): Promise<CompileEmailResult> {
  const email = input.email
  if (!isSafeEmailId(email.id) || email.event.length === 0 || input.locale.length === 0) {
    return fail([errorDiagnostic('CFG001', 'The email id, event, or locale is invalid.', { templateId: email.id })])
  }

  const catalogIssues = checkCatalogs([input.locale], { [input.locale]: input.catalog }).map((issue) => ({
    ...issue,
    templateId: email.id,
  }))
  if (catalogIssues.length > 0) return fail(catalogIssues)

  const session = createSession({
    locale: input.locale,
    catalog: input.catalog,
    profile: input.profile,
    tailwind: input.tailwind,
    templateId: email.id,
    ...(input.file ? { file: input.file } : {}),
  })

  let html: string
  try {
    html = await runSession(session, () => render(createElement(email.template), { pretty: false }))
  } catch (error) {
    const aborted = readAborted(error)
    if (aborted) return fail(aborted)
    const className = classNameExpression(error, email.id, input.file)
    if (className) return fail(className)
    throw error
  }

  if (session.diagnostics.length > 0) return fail(session.diagnostics)
  const bound = bindSites(html, session.markers, session.sites, input.profile)
  if (!bound.ok) {
    return fail(bound.diagnostics.map((issue) => ({ ...issue, templateId: email.id, locale: input.locale })))
  }
  const restored = restoreHandlebars(html, bound.markers)
  if (!restored.ok) {
    return fail(restored.diagnostics.map((issue) => ({ ...issue, templateId: email.id, locale: input.locale })))
  }

  const content = normalizeOutput(restored.html)
  const syntax = validateHandlebarsSyntax(content, syntaxHelperNames(input.profile))
  if (syntax) return fail([{ ...syntax, templateId: email.id, locale: input.locale }])

  const diagnostics = targetWarnings(bound.used, email.id)
  const digest = sha256(content)
  return {
    ok: true,
    artifacts: [{ name: `${email.id}.html`, content, sha256: digest }],
    diagnostics,
    manifest: {
      formatVersion: 1,
      templateId: email.id,
      event: email.event,
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
    },
    structure: bound.structure,
  }
}

function targetWarnings(used: readonly EmissionCapability[], templateId: string): Diagnostic[] {
  return used
    .filter((capability) => capability.evidence !== 'verified')
    .map((capability) =>
      warningDiagnostic(
        'TARGET001',
        `Capability ${capability.name} is ${capability.evidence} and is not verified on the destination.`,
        { templateId },
      ),
    )
}

function fail(diagnostics: Diagnostic[]): CompileEmailResult {
  return { ok: false, diagnostics }
}

function classNameExpression(error: unknown, templateId: string, file: string | undefined): Diagnostic[] | null {
  if (!(error instanceof TypeError) || !error.message.includes('className') || !error.message.includes('split'))
    return null
  return [
    errorDiagnostic('DSL002', 'Expressions are not supported in className.', {
      templateId,
      ...(file ? { source: { file } } : {}),
    }),
  ]
}

function readAborted(error: unknown): Diagnostic[] | null {
  if (error instanceof CompileAborted) return error.diagnostics
  if (typeof error === 'object' && error !== null && 'cause' in error) return readAborted(error.cause)
  return null
}
