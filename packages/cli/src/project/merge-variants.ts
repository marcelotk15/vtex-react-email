import type { BuildManifest } from '@vtex-email/react'

import {
  errorDiagnostic,
  findCapability,
  mergeLocaleDocuments,
  normalizeOutput,
  sha256,
  syntaxHelperNames,
  unverifiedCapabilityDiagnostic,
  validateHandlebarsSyntax,
  type Diagnostic,
} from '@vtex-email/core'

import type { BuiltFile, LoadedProfile, ResolvedEmail } from './types'

export interface LocaleDocument {
  locale: string
  html: string
  sha256: string
}

export function mergeVariants(input: {
  email: ResolvedEmail
  profile: LoadedProfile
  documents: LocaleDocument[]
  files: BuiltFile[]
  diagnostics: Diagnostic[]
  manifest: BuildManifest | null
}): BuildManifest | null {
  const { email, profile, documents, files, diagnostics } = input
  let documentManifest = input.manifest
  if (
    email.output === 'merged' &&
    !diagnostics.some((item) => item.severity === 'error') &&
    documents.length === email.locales.length
  ) {
    const branches =
      documents.filter((document) => document.locale !== email.defaultLocale).length + email.aliases.length
    if (branches > 0 && !profile.emission.capabilities.some((item) => item.name === 'eq' && item.form === 'block')) {
      diagnostics.push(
        errorDiagnostic('HBS002', 'Merged output requires the experimental eq capability.', {
          templateId: email.definition.id,
        }),
      )
    } else {
      const merged = normalizeOutput(
        mergeLocaleDocuments({
          localePath: email.localePath,
          defaultLocale: email.defaultLocale,
          documents: documents.map((document) => ({ locale: document.locale, html: document.html })),
          aliases: email.aliases,
          equality: 'eq',
        }),
      )
      const syntax = validateHandlebarsSyntax(merged, syntaxHelperNames(profile.emission))
      if (syntax) diagnostics.push({ ...syntax, templateId: email.definition.id })
      else {
        files.push({
          name: `${email.definition.id}.html`,
          content: merged,
          sha256: sha256(merged),
          role: 'merged',
        })
        if (branches > 0)
          documentManifest = recordEmittedEquality(profile, email.definition.id, diagnostics, documentManifest)
      }
    }
  }
  if (email.output === 'per-locale') {
    const mergedIndex = files.findIndex((file) => file.role === 'merged')
    if (mergedIndex >= 0) files.splice(mergedIndex, 1)
  }
  return documentManifest
}

function recordEmittedEquality(
  profile: LoadedProfile,
  templateId: string,
  diagnostics: Diagnostic[],
  manifest: BuildManifest | null,
): BuildManifest | null {
  const eq = findCapability(profile.emission, 'eq', 'block')
  if (!eq) return manifest
  if (eq.evidence !== 'verified') {
    const issue = unverifiedCapabilityDiagnostic(eq, templateId)
    if (issue) diagnostics.push(issue)
  }
  if (!manifest || manifest.capabilities.some((item) => item.name === eq.name)) return manifest
  return {
    ...manifest,
    capabilities: [...manifest.capabilities, { name: eq.name, evidence: eq.evidence, note: eq.note }],
  }
}
