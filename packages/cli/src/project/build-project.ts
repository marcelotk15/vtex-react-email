import { errorDiagnostic, syntaxHelperNames } from '@vtex-email/core'
import { p0Profile } from '@vtex-email/vtex'

import type { ResolvedConfig } from '../config/config'

import { loadProjectConfig } from '../config/load-config'
import { compileOne } from './compile-email'
import { discoverEmails } from './discover'
import { projectManifest } from './manifest'
import {
  emptyProject,
  exitOk,
  exitUsage,
  exitValidation,
  type LoadedProfile,
  type ProjectResult,
  type ResolvedEmail,
} from './types'
import { writeOutput } from './write-output'

export async function buildProject(input: {
  configPath: string
  onlyId?: string
  write?: boolean
  warningsAsErrors?: boolean
  locale?: string
}): Promise<ProjectResult> {
  const loaded = await loadProjectConfig(input.configPath)
  if (!loaded.ok) return emptyProject(exitUsage, loaded.diagnostics)
  return buildResolved(loaded.config, input)
}

export function validateProject(input: {
  configPath: string
  onlyId?: string
  warningsAsErrors?: boolean
}): Promise<ProjectResult> {
  return buildProject({ ...input, write: false })
}

export async function buildResolved(
  config: ResolvedConfig,
  input: {
    onlyId?: string
    write?: boolean
    warningsAsErrors?: boolean
    locale?: string
  },
): Promise<ProjectResult> {
  const prepared = await prepareResolved(config, input.onlyId)
  if (!prepared.ok) return prepared.result
  const localeIssue = rejectLocale(config, prepared.emails, input.locale)
  if (localeIssue) return localeIssue
  const emails =
    input.warningsAsErrors === true
      ? prepared.emails.map((email) => ({ ...email, warningsAsErrors: true }))
      : prepared.emails
  const compiled = await compileProject(config, prepared.profile, emails)
  if (!compiled.ok || input.write === false) return compiled
  return writeCompiled(
    config.outDir,
    compiled,
    input.onlyId,
    syntaxHelperNames(prepared.profile.emission),
    input.locale,
  )
}

async function compileProject(
  config: ResolvedConfig,
  profile: LoadedProfile,
  emails: ResolvedEmail[],
): Promise<ProjectResult> {
  const built: ProjectResult['emails'] = []
  for (const email of emails) built.push(await compileOne(config, profile, email))
  const diagnostics = built.flatMap((email) => email.diagnostics)
  const failed = diagnostics.some((item) => item.severity === 'error')
  const manifest = projectManifest(profile.emission.id, built)
  if (failed) {
    return { ok: false, exitCode: exitValidation, diagnostics, manifest, emails: built, wrote: [], preserved: [] }
  }
  return { ok: true, exitCode: exitOk, diagnostics, manifest, emails: built, wrote: [], preserved: [] }
}

async function prepareResolved(
  config: ResolvedConfig,
  onlyId: string | undefined,
): Promise<{ ok: true; profile: LoadedProfile; emails: ResolvedEmail[] } | { ok: false; result: ProjectResult }> {
  const profile: LoadedProfile = {
    emission: {
      id: p0Profile.id,
      allowParentSegments: p0Profile.allowParentSegments,
      capabilities: p0Profile.capabilities,
    },
    simulator: { helpers: p0Profile.helpers },
  }
  const discovered = await discoverEmails(config)
  if (!discovered.ok) return { ok: false, result: emptyProject(exitUsage, discovered.diagnostics) }
  const selected = onlyId ? discovered.emails.filter((email) => email.definition.id === onlyId) : discovered.emails
  if (onlyId && selected.length === 0) {
    return { ok: false, result: emptyProject(exitUsage, [errorDiagnostic('CFG001', `Unknown email: ${onlyId}`)]) }
  }
  return { ok: true, profile, emails: selected }
}

function rejectLocale(
  config: ResolvedConfig,
  emails: readonly ResolvedEmail[],
  locale: string | undefined,
): ProjectResult | null {
  if (!locale) return null
  if (!config.locales.includes(locale)) {
    return emptyProject(exitUsage, [errorDiagnostic('CFG001', `Unknown locale: ${locale}`)])
  }
  const diagnostics = emails
    .filter((email) => !email.locales.includes(locale))
    .map((email) =>
      errorDiagnostic('CFG001', `Locale ${locale} is not enabled for ${email.definition.id}.`, {
        templateId: email.definition.id,
      }),
    )
  if (diagnostics.length === 0) return null
  return emptyProject(exitUsage, diagnostics)
}

async function writeCompiled(
  outDir: string,
  compiled: ProjectResult,
  onlyId: string | undefined,
  helperNames: readonly string[],
  locale: string | undefined,
): Promise<ProjectResult> {
  if (!compiled.manifest) return compiled
  const written = await writeOutput(outDir, compiled.manifest, compiled.emails, onlyId, helperNames, locale)
  if (!written.ok) {
    return {
      ok: false,
      exitCode: exitValidation,
      diagnostics: [...compiled.diagnostics, written.diagnostic],
      manifest: compiled.manifest,
      emails: compiled.emails,
      wrote: [],
      preserved: [],
    }
  }
  return {
    ok: true,
    exitCode: exitOk,
    diagnostics: compiled.diagnostics,
    manifest: written.manifest,
    emails: compiled.emails,
    wrote: written.wrote,
    preserved: written.preserved,
  }
}
