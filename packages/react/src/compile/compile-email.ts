import { render, type TailwindConfig } from '@react-email/components'
import {
  assembleDocument,
  checkCatalogs,
  errorDiagnostic,
  isSafeEmailId,
  type CompileEmailResult,
  type Diagnostic,
  type EmailDocument,
  type EmissionProfile,
} from '@vtex-email/core'
import { createElement, type ReactNode } from 'react'

import { CompileAborted, createSession, runSession } from './session'

export type { BuildManifest, CompiledArtifact, CompileEmailResult } from '@vtex-email/core'

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
  return assembleDocument({
    html,
    markers: session.markers,
    sites: session.sites,
    profile: input.profile,
    templateId: email.id,
    event: email.event,
    locale: input.locale,
  })
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
