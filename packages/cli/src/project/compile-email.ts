import {
  analyzePaths,
  analyzeRootPath,
  checkCatalogs,
  errorDiagnostic,
  sha256,
  type Diagnostic,
  type ScopeNode,
} from '@vtex-email/core'
import { compileEmail, diagnoseStyles, type BuildManifest } from '@vtex-email/react'

import type { ResolvedConfig } from '../config/config'
import type { BuiltEmail, BuiltFile, LoadedProfile, ResolvedEmail } from './types'

import { readCatalogs } from './catalogs'
import { checkLoadedFixtures, readFixtures } from './fixtures'
import { mergeVariants, type LocaleDocument } from './merge-variants'
import { applyPolicy } from './policy'

export async function compileOne(
  config: ResolvedConfig,
  profile: LoadedProfile,
  email: ResolvedEmail,
): Promise<BuiltEmail> {
  const diagnostics: Diagnostic[] = []
  const catalogs = await readCatalogs(config, email.locales, diagnostics)
  diagnostics.push(
    ...checkCatalogs(email.locales, catalogs).map((issue) => ({ ...issue, templateId: email.definition.id })),
  )
  const fixtures = await readFixtures(config.configDir, email.definition.id, email.definition.fixtures, diagnostics)
  const compiled = await compileLocales(config, profile, email, catalogs, diagnostics)
  if (compiled) analyzeContract(email, compiled.structure, diagnostics)
  diagnostics.push(...checkLoadedFixtures(email.definition.id, email.definition.schema, fixtures))
  const files: BuiltFile[] = (compiled?.documents ?? []).map((document) => ({
    name: `locales/${document.locale}/${email.definition.id}.html`,
    content: document.html,
    sha256: document.sha256,
    role: 'locale',
    locale: document.locale,
  }))
  const documentManifest = mergeVariants({
    email,
    profile,
    documents: compiled?.documents ?? [],
    files,
    diagnostics,
    manifest: compiled?.manifest ?? null,
  })
  const adjusted = applyPolicy(diagnostics, email)
  return {
    id: email.definition.id,
    event: email.definition.event,
    output: email.output,
    locales: email.locales,
    defaultLocale: email.defaultLocale,
    localePath: email.localePath,
    files: email.output === 'per-locale' ? files.filter((file) => file.role === 'locale') : files,
    diagnostics: adjusted,
    structure: compiled?.structure ?? [],
    dependencies: email.dependencies,
    fixtures,
    fixturesPattern: email.definition.fixtures,
    file: email.file,
    schema: email.definition.schema,
    manifest: documentManifest,
    profile,
    warnRenderedBytes: config.compatibility.warnRenderedBytes,
  }
}

async function compileLocales(
  config: ResolvedConfig,
  profile: LoadedProfile,
  email: ResolvedEmail,
  catalogs: Record<string, Record<string, string>>,
  diagnostics: Diagnostic[],
): Promise<{ documents: LocaleDocument[]; structure: ScopeNode[]; manifest: BuildManifest | null } | null> {
  if (diagnostics.some((item) => item.severity === 'error')) return null
  const documents: LocaleDocument[] = []
  let structure: ScopeNode[] = []
  let documentManifest: BuildManifest | null = null
  const compiled = await Promise.all(
    email.locales.map(async (locale) => {
      const catalog = catalogs[locale] ?? {}
      const result = await compileEmail({
        email: {
          id: email.definition.id,
          event: email.definition.event,
          template: email.definition.template,
        } as Parameters<typeof compileEmail>[0]['email'],
        locale,
        catalog,
        profile: profile.emission,
        tailwind: config.tailwind,
        file: email.file,
      })
      return { locale, result }
    }),
  )
  for (const item of compiled) {
    if (!item.result.ok) {
      diagnostics.push(...item.result.diagnostics)
      continue
    }
    const content = item.result.artifacts[0]?.content ?? ''
    const digest = item.result.artifacts[0]?.sha256 ?? sha256(content)
    documents.push({ locale: item.locale, html: content, sha256: digest })
    diagnostics.push(...item.result.diagnostics)
    diagnostics.push(
      ...diagnoseStyles(content).map((issue) => ({ ...issue, templateId: email.definition.id, locale: item.locale })),
    )
    if (content.length > config.compatibility.maxSourceBytes) {
      diagnostics.push(
        errorDiagnostic('SIZE001', `Source exceeds maxSourceBytes (${config.compatibility.maxSourceBytes}).`, {
          templateId: email.definition.id,
          locale: item.locale,
        }),
      )
    }
    if (item.locale === email.defaultLocale) {
      structure = item.result.structure
      documentManifest = item.result.manifest
    }
  }
  if (structure.length === 0 && documents[0]) {
    const first = compiled.find((item) => item.result.ok)
    if (first?.result.ok) structure = first.result.structure
  }
  return { documents, structure, manifest: documentManifest }
}

function analyzeContract(email: ResolvedEmail, structure: ScopeNode[], diagnostics: Diagnostic[]): void {
  diagnostics.push(
    ...analyzePaths(email.definition.schema, structure).map((issue) => ({
      ...issue,
      templateId: email.definition.id,
    })),
  )
  const localeIssue = analyzeRootPath(email.definition.schema, email.localePath)
  if (localeIssue) diagnostics.push({ ...localeIssue, templateId: email.definition.id, path: email.localePath })
}
