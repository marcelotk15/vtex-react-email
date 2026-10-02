import type { ZodType } from 'zod'

import {
  analyzePaths,
  analyzeRootPath,
  checkCatalogs,
  checkFixture,
  commitArtifacts,
  errorDiagnostic,
  evaluateArtifact,
  warningDiagnostic,
  isSafeEmailId,
  mergeLocaleDocuments,
  normalizeOutput,
  parsePath,
  releaseArtifacts,
  sha256,
  syntaxHelperNames,
  TemplateFailure,
  validateHandlebarsSyntax,
  withForcedLocale,
  type Diagnostic,
  type EmailDefinition,
  type EmissionProfile,
  type LocalSimulator,
  type ScopeNode,
} from '@vtex-email/core'
import { compileEmail, diagnoseStyles, loadEmailEntry, type BuildManifest } from '@vtex-email/react'
import { glob, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

import { importBundled } from './bundle'
import { configuredOutputError, validateConfig, type ResolvedConfig } from './config'

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

interface LoadedProfile {
  emission: EmissionProfile
  simulator: LocalSimulator
}

interface ResolvedEmail {
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

export async function buildProject(input: {
  configPath: string
  onlyId?: string
  write?: boolean
  warningsAsErrors?: boolean
  locale?: string
}): Promise<ProjectResult> {
  const prepared = await prepare(input.configPath, input.onlyId)
  if (!prepared.ok) return prepared.result
  const localeIssue = rejectLocale(prepared.config, prepared.emails, input.locale)
  if (localeIssue) return localeIssue
  const emails =
    input.warningsAsErrors === true
      ? prepared.emails.map((email) => ({ ...email, warningsAsErrors: true }))
      : prepared.emails
  const built = await compileAll(prepared.config, prepared.profile, emails)
  const diagnostics = built.flatMap((email) => email.diagnostics)
  const failed = diagnostics.some((item) => item.severity === 'error')
  const manifest = projectManifest(prepared.profile.emission.id, built)
  if (failed)
    return { ok: false, exitCode: exitValidation, diagnostics, manifest, emails: built, wrote: [], preserved: [] }
  if (input.write === false)
    return { ok: true, exitCode: exitOk, diagnostics, manifest, emails: built, wrote: [], preserved: [] }
  const written = await writeOutput(
    prepared.config.outDir,
    manifest,
    built,
    input.onlyId,
    syntaxHelperNames(prepared.profile.emission),
    input.locale,
  )
  if (!written.ok) {
    return {
      ok: false,
      exitCode: exitValidation,
      diagnostics: [...diagnostics, written.diagnostic],
      manifest,
      emails: built,
      wrote: [],
      preserved: [],
    }
  }
  return {
    ok: true,
    exitCode: exitOk,
    diagnostics,
    manifest: written.manifest,
    emails: built,
    wrote: written.wrote,
    preserved: written.preserved,
  }
}

export function validateProject(input: {
  configPath: string
  onlyId?: string
  warningsAsErrors?: boolean
}): Promise<ProjectResult> {
  return buildProject({ ...input, write: false })
}

export async function renderPreview(input: {
  configPath: string
  emailId: string
  fixtureId: string
  mode: 'runtime' | 'forced' | 'locale'
  locale?: string
  warningsAsErrors?: boolean
}): Promise<PreviewResult> {
  const built = await buildProject({
    configPath: input.configPath,
    onlyId: input.emailId,
    write: false,
    warningsAsErrors: input.warningsAsErrors,
  })
  if (!built.ok) {
    return emptyPreview(built.exitCode, built.diagnostics)
  }
  const email = built.emails.find((item) => item.id === input.emailId)
  if (!email) {
    return emptyPreview(exitUsage, [errorDiagnostic('CFG001', `Unknown email: ${input.emailId}`)])
  }
  return previewBuiltEmail({
    email,
    fixtureId: input.fixtureId,
    mode: input.mode,
    locale: input.locale,
  })
}

export function previewBuiltEmail(input: {
  email: BuiltEmail
  fixtureId: string
  mode: 'runtime' | 'forced' | 'locale'
  locale?: string
}): PreviewResult {
  const email = input.email
  const fixture = email.fixtures.find((item) => item.id === input.fixtureId && !item.negative)
  if (!fixture) {
    return emptyPreview(exitUsage, [errorDiagnostic('CFG001', `Unknown fixture: ${input.fixtureId}`)])
  }
  const payloadLocale = readPayloadLocale(fixture.data, email.localePath)
  const merged = email.files.find((file) => file.role === 'merged')
  if (input.mode === 'forced') {
    if (!merged) {
      return {
        ...emptyPreview(exitValidation, [
          errorDiagnostic('HBS002', 'Forced locale uses the merged artifact.', { templateId: email.id }),
        ]),
        selector: true,
        locale: input.locale ?? '',
        payloadLocale,
      }
    }
    if (!input.locale) {
      return {
        ...emptyPreview(exitUsage, [errorDiagnostic('CFG001', 'Forced locale requires a locale.')]),
        source: merged.content,
        selector: true,
        payloadLocale,
      }
    }
    const forced = withForcedLocale(fixture.data, email.localePath, input.locale)
    if (!forced.ok) {
      return {
        ...emptyPreview(exitValidation, [errorDiagnostic('DATA001', forced.message, { path: email.localePath })]),
        source: merged.content,
        selector: true,
        locale: input.locale,
        payloadLocale,
      }
    }
    return { ...runEvaluation(email, merged.content, forced.data, true, input.locale), payloadLocale }
  }
  if (input.mode === 'locale' || !merged) {
    const locale = input.locale ?? readLocale(fixture.data, email) ?? email.defaultLocale
    const file = email.files.find((item) => item.role === 'locale' && item.locale === locale)
    if (!file) {
      return {
        ...emptyPreview(exitUsage, [errorDiagnostic('CFG001', `Unknown locale: ${locale}`)]),
        locale,
        payloadLocale,
      }
    }
    return { ...runEvaluation(email, file.content, fixture.data, false, locale), payloadLocale }
  }
  return {
    ...runEvaluation(email, merged.content, fixture.data, true, readLocale(fixture.data, email) ?? email.defaultLocale),
    payloadLocale,
  }
}

export async function refreshEmailFixtures(email: BuiltEmail, configDir: string): Promise<BuiltEmail> {
  const readDiagnostics: Diagnostic[] = []
  const fixtures = await readFixtures(configDir, email.id, email.fixturesPattern, readDiagnostics)
  const kept = email.diagnostics.filter((item) => item.fixtureId === undefined)
  return {
    ...email,
    fixtures,
    diagnostics: [...kept, ...readDiagnostics, ...checkLoadedFixtures(email.id, email.schema, fixtures)],
  }
}

export async function exportPreview(input: {
  configPath: string
  emailId: string
  fixtureId: string
  outDir: string
  warningsAsErrors?: boolean
}): Promise<PreviewResult & { wrote: string[] }> {
  const configDir = path.dirname(input.configPath)
  let loaded: Record<string, unknown>
  try {
    loaded = await importBundled(input.configPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the config.'
    return previewFailure(exitUsage, [errorDiagnostic('CFG001', message, { source: { file: input.configPath } })])
  }
  const validated = validateConfig(loaded.default, configDir)
  if (!validated.ok) return previewFailure(exitUsage, validated.diagnostics)
  const outputError = configuredOutputError(validated.config, input.outDir)
  if (outputError) return previewFailure(exitUsage, [errorDiagnostic('CFG001', outputError)])
  const preview = await renderPreview({
    configPath: input.configPath,
    emailId: input.emailId,
    fixtureId: input.fixtureId,
    mode: 'runtime',
    warningsAsErrors: input.warningsAsErrors,
  })
  if (!preview.ok) return { ...preview, wrote: [] }
  const name = `${input.emailId}.${input.fixtureId}.html`
  await commitArtifacts(path.resolve(input.outDir), [{ name, content: preview.html }])
  return { ...preview, wrote: [name] }
}

function previewFailure(exitCode: 1 | 2, diagnostics: Diagnostic[]): PreviewResult & { wrote: string[] } {
  return { ...emptyPreview(exitCode, diagnostics), wrote: [] }
}

function emptyPreview(exitCode: 0 | 1 | 2, diagnostics: Diagnostic[]): PreviewResult {
  return { ok: false, exitCode, html: '', source: '', diagnostics, selector: false, locale: '', payloadLocale: null }
}

function rejectLocale(
  config: ResolvedConfig,
  emails: readonly ResolvedEmail[],
  locale: string | undefined,
): ProjectResult | null {
  if (!locale) return null
  if (!config.locales.includes(locale)) {
    return empty(exitUsage, [errorDiagnostic('CFG001', `Unknown locale: ${locale}`)])
  }
  const diagnostics = emails
    .filter((email) => !email.locales.includes(locale))
    .map((email) =>
      errorDiagnostic('CFG001', `Locale ${locale} is not enabled for ${email.definition.id}.`, {
        templateId: email.definition.id,
      }),
    )
  if (diagnostics.length === 0) return null
  return empty(exitUsage, diagnostics)
}

function runEvaluation(
  email: BuiltEmail,
  source: string,
  data: unknown,
  selector: boolean,
  locale: string,
): PreviewResult {
  try {
    const html = evaluateArtifact({
      source,
      data,
      profile: email.profile.emission,
      simulator: email.profile.simulator,
    })
    const diagnostics = email.diagnostics.slice()
    if (html.length > email.warnRenderedBytes) {
      diagnostics.push(warningSize(email.id, html.length, email.warnRenderedBytes))
    }
    return { ok: true, exitCode: exitOk, html, source, diagnostics, selector, locale, payloadLocale: null }
  } catch (error) {
    const failure =
      error instanceof TemplateFailure
        ? error.diagnostics
        : [errorDiagnostic('HBS001', error instanceof Error ? error.message : 'Preview failed.')]
    return {
      ok: false,
      exitCode: exitValidation,
      html: '',
      source,
      diagnostics: [...email.diagnostics, ...failure],
      selector,
      locale,
      payloadLocale: null,
    }
  }
}

function warningSize(templateId: string, bytes: number, limit: number): Diagnostic {
  return {
    code: 'SIZE001',
    severity: 'warning',
    message: `Rendered preview is ${bytes} bytes, above ${limit}. This check does not establish compatibility with email clients.`,
    templateId,
  }
}

async function prepare(
  configPath: string,
  onlyId: string | undefined,
): Promise<
  | { ok: true; config: ResolvedConfig; profile: LoadedProfile; emails: ResolvedEmail[] }
  | { ok: false; result: ProjectResult }
> {
  const configDir = path.dirname(configPath)
  let loaded: Record<string, unknown>
  try {
    loaded = await importBundled(configPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the config.'
    return {
      ok: false,
      result: empty(exitUsage, [errorDiagnostic('CFG001', message, { source: { file: configPath } })]),
    }
  }
  const validated = validateConfig(loaded.default, configDir)
  if (!validated.ok) return { ok: false, result: empty(exitUsage, validated.diagnostics) }
  let profileModule: Record<string, unknown>
  try {
    profileModule = await importBundled(validated.config.profilePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the profile.'
    return { ok: false, result: empty(exitUsage, [errorDiagnostic('CFG001', message)]) }
  }
  const profile = readProfile(profileModule)
  if (!profile)
    return { ok: false, result: empty(exitUsage, [errorDiagnostic('CFG001', 'The target profile is invalid.')]) }
  const files = await discoverFiles(validated.config)
  const emails: ResolvedEmail[] = []
  const diagnostics: Diagnostic[] = []
  for (const file of files) {
    const entry = await loadEmailEntry(file)
    if (!entry.ok) {
      diagnostics.push(...entry.diagnostics)
      continue
    }
    const definition = entry.module.default
    if (!isDefinition(definition)) {
      diagnostics.push(
        errorDiagnostic('CFG001', 'The email module must default-export defineEmail.', { source: { file } }),
      )
      continue
    }
    if (!isSafeEmailId(definition.id)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Invalid email id: ${definition.id}`, {
          source: { file },
          templateId: definition.id,
        }),
      )
      continue
    }
    const resolved = resolveEmail(validated.config, definition, file, entry.dependencies)
    if (!resolved.ok) {
      diagnostics.push(...resolved.diagnostics)
      continue
    }
    emails.push(resolved.email)
  }
  const duplicate = duplicateId(emails.map((email) => email.definition.id))
  if (duplicate) diagnostics.push(errorDiagnostic('CFG001', `Duplicate email id: ${duplicate}`))
  if (diagnostics.length > 0) return { ok: false, result: empty(exitUsage, diagnostics) }
  const selected = onlyId ? emails.filter((email) => email.definition.id === onlyId) : emails
  if (onlyId && selected.length === 0) {
    return { ok: false, result: empty(exitUsage, [errorDiagnostic('CFG001', `Unknown email: ${onlyId}`)]) }
  }
  return { ok: true, config: validated.config, profile, emails: selected }
}

async function compileAll(
  config: ResolvedConfig,
  profile: LoadedProfile,
  emails: ResolvedEmail[],
): Promise<BuiltEmail[]> {
  const built: BuiltEmail[] = []
  for (const email of emails) {
    built.push(await compileOne(config, profile, email))
  }
  return built
}

async function compileOne(config: ResolvedConfig, profile: LoadedProfile, email: ResolvedEmail): Promise<BuiltEmail> {
  const diagnostics: Diagnostic[] = []
  const catalogs = await readCatalogs(config, email.locales, diagnostics)
  diagnostics.push(
    ...checkCatalogs(email.locales, catalogs).map((issue) => ({ ...issue, templateId: email.definition.id })),
  )
  const fixtures = await readFixtures(config.configDir, email.definition.id, email.definition.fixtures, diagnostics)
  const documents: Array<{ locale: string; html: string; sha256: string }> = []
  let structure: ScopeNode[] = []
  let documentManifest: BuildManifest | null = null
  if (!diagnostics.some((item) => item.severity === 'error')) {
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
    diagnostics.push(
      ...analyzePaths(email.definition.schema, structure).map((issue) => ({
        ...issue,
        templateId: email.definition.id,
      })),
    )
    const localeIssue = analyzeRootPath(email.definition.schema, email.localePath)
    if (localeIssue) diagnostics.push({ ...localeIssue, templateId: email.definition.id, path: email.localePath })
  }
  diagnostics.push(...checkLoadedFixtures(email.definition.id, email.definition.schema, fixtures))
  const files: BuiltFile[] = documents.map((document) => ({
    name: `locales/${document.locale}/${email.definition.id}.html`,
    content: document.html,
    sha256: document.sha256,
    role: 'locale',
    locale: document.locale,
  }))
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
  const adjusted = applyPolicy(diagnostics, email)
  const result: BuiltEmail & { profile: LoadedProfile } = {
    id: email.definition.id,
    event: email.definition.event,
    output: email.output,
    locales: email.locales,
    defaultLocale: email.defaultLocale,
    localePath: email.localePath,
    files: email.output === 'per-locale' ? files.filter((file) => file.role === 'locale') : files,
    diagnostics: adjusted,
    structure,
    dependencies: email.dependencies,
    fixtures,
    fixturesPattern: email.definition.fixtures,
    file: email.file,
    schema: email.definition.schema,
    manifest: documentManifest,
    profile,
    warnRenderedBytes: config.compatibility.warnRenderedBytes,
  }
  return result
}

function applyPolicy(diagnostics: Diagnostic[], email: ResolvedEmail): Diagnostic[] {
  return diagnostics.map((issue) => {
    let severity = issue.severity
    if (issue.code === 'PATH001' && email.unknownPath === 'warning') severity = 'warning'
    if (issue.code === 'TARGET001' && email.unverifiedCapability === 'error') severity = 'error'
    if (severity === 'warning' && email.warningsAsErrors) severity = 'error'
    return severity === issue.severity ? issue : { ...issue, severity }
  })
}

async function writeOutput(
  outDir: string,
  manifest: ProjectManifest,
  emails: BuiltEmail[],
  onlyId: string | undefined,
  helperNames: readonly string[],
  locale: string | undefined,
): Promise<
  { ok: true; manifest: ProjectManifest; wrote: string[]; preserved: string[] } | { ok: false; diagnostic: Diagnostic }
> {
  const manifestPath = path.join(outDir, 'manifest.json')
  const previous = await readManifest(manifestPath)
  const nextEmails = locale
    ? localeInventory(previous, manifest, locale)
    : onlyId && previous
      ? [...previous.emails.filter((item) => item.id !== onlyId), ...manifest.emails]
      : manifest.emails
  const next: ProjectManifest = {
    formatVersion: 1,
    profileId: manifest.profileId,
    homologation: 'experimental',
    emails: nextEmails.sort((left, right) => left.id.localeCompare(right.id)),
  }
  const selected = new Set(emails.map((email) => email.id))
  const replacements = emails.flatMap((email) =>
    email.files.filter((file) => !locale || (file.role === 'locale' && file.locale === locale)),
  )
  const issue = await releaseArtifacts({
    helperNames,
    directory: outDir,
    files: replacements.map((file) => ({ name: file.name, content: file.content })),
  })
  if (issue) return { ok: false, diagnostic: issue }
  await commitArtifacts(outDir, [{ name: 'manifest.json', content: `${JSON.stringify(next, null, 2)}\n` }])
  const kept = new Set(next.emails.flatMap((email) => email.files.map((file) => file.name)))
  for (const email of previous?.emails ?? []) {
    if (onlyId && email.id !== onlyId) continue
    if (locale && !selected.has(email.id)) continue
    for (const file of email.files) {
      if (!kept.has(file.name)) await rm(path.join(outDir, file.name), { force: true })
    }
  }
  const wroteNames = new Set(replacements.map((file) => file.name))
  const preserved = next.emails
    .flatMap((email) => email.files.map((file) => file.name))
    .filter((name) => !wroteNames.has(name))
  return { ok: true, manifest: next, wrote: [...wroteNames, 'manifest.json'], preserved }
}

function projectManifest(profileId: string, emails: BuiltEmail[]): ProjectManifest {
  return {
    formatVersion: 1,
    profileId,
    homologation: 'experimental',
    emails: emails.map((email) => ({
      id: email.id,
      event: email.event,
      output: email.output,
      locales: email.locales,
      defaultLocale: email.defaultLocale,
      files: email.files.map((file) => ({
        name: file.name,
        sha256: file.sha256,
        role: file.role,
        ...(file.locale ? { locale: file.locale } : {}),
      })),
      capabilities: email.manifest?.capabilities.map((item) => ({ name: item.name, evidence: item.evidence })) ?? [],
      warnings: email.diagnostics.filter((item) => item.severity === 'warning').map((item) => item.message),
    })),
  }
}

async function discoverFiles(config: ResolvedConfig): Promise<string[]> {
  const found = new Set<string>()
  for (const pattern of config.emails) {
    for await (const entry of glob(pattern, { cwd: config.configDir })) {
      found.add(path.resolve(config.configDir, entry))
    }
  }
  return [...found].sort()
}

function resolveEmail(
  config: ResolvedConfig,
  definition: EmailDefinition<() => unknown>,
  file: string,
  dependencies: string[],
): { ok: true; email: ResolvedEmail } | { ok: false; diagnostics: Diagnostic[] } {
  const locales = [...(definition.i18n.locales ?? config.locales)]
  const diagnostics: Diagnostic[] = []
  for (const locale of locales) {
    if (!config.locales.includes(locale)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Locale ${locale} is not enabled by the project.`, { templateId: definition.id }),
      )
    }
  }
  const defaultLocale = definition.i18n.defaultLocale ?? config.defaultLocale
  if (!locales.includes(defaultLocale)) {
    diagnostics.push(
      errorDiagnostic('CFG001', 'The email default locale is not in its locale list.', { templateId: definition.id }),
    )
  }
  const aliases = Object.entries(definition.i18n.aliases ?? {}).map(([alias, locale]) => ({ alias, locale }))
  for (const alias of aliases) {
    if (!locales.includes(alias.locale)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Alias ${alias.alias} points at an unknown locale.`, { templateId: definition.id }),
      )
    }
  }
  if (!parsePath(definition.i18n.localePath, true).ok) {
    diagnostics.push(
      errorDiagnostic('CFG001', `Invalid locale path: ${definition.i18n.localePath}`, { templateId: definition.id }),
    )
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics }
  return {
    ok: true,
    email: {
      definition,
      file,
      dependencies,
      locales,
      defaultLocale,
      localePath: definition.i18n.localePath,
      output: definition.i18n.output ?? 'merged',
      aliases,
      unknownPath: definition.validation?.unknownPath ?? config.validation.unknownPath,
      warningsAsErrors: definition.validation?.warningsAsErrors ?? config.validation.warningsAsErrors,
      unverifiedCapability: config.validation.unverifiedCapability,
    },
  }
}

export function duplicateId(ids: readonly string[]): string | null {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return id
    seen.add(id)
  }
  return null
}

function isDefinition(value: unknown): value is EmailDefinition<() => unknown> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<EmailDefinition<() => unknown>>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.event === 'string' &&
    typeof candidate.template === 'function' &&
    typeof candidate.fixtures === 'string' &&
    !!candidate.schema &&
    typeof candidate.schema === 'object' &&
    'safeParse' in candidate.schema &&
    !!candidate.i18n &&
    typeof candidate.i18n.localePath === 'string'
  )
}

function readProfile(module: Record<string, unknown>): LoadedProfile | null {
  const candidate = module.profile ?? module.default
  if (!candidate || typeof candidate !== 'object') return null
  const value = candidate as Partial<EmissionProfile> & { helpers?: LocalSimulator['helpers'] }
  if (
    typeof value.id !== 'string' ||
    typeof value.allowParentSegments !== 'boolean' ||
    !Array.isArray(value.capabilities)
  )
    return null
  return {
    emission: {
      id: value.id,
      allowParentSegments: value.allowParentSegments,
      capabilities: value.capabilities,
    },
    simulator: { helpers: Array.isArray(value.helpers) ? value.helpers : [] },
  }
}

async function readCatalogs(
  config: ResolvedConfig,
  locales: readonly string[],
  diagnostics: Diagnostic[],
): Promise<Record<string, Record<string, string>>> {
  const catalogs: Record<string, Record<string, string>> = {}
  for (const locale of locales) {
    const relative = config.catalogs.replaceAll('{locale}', locale)
    const file = path.resolve(config.configDir, relative)
    try {
      const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
      if (!isFlatCatalog(parsed)) {
        diagnostics.push(errorDiagnostic('I18N001', `Catalog ${locale} must be a flat string map.`, { locale }))
        continue
      }
      catalogs[locale] = parsed
    } catch (error) {
      const message = error instanceof Error ? error.message : `Missing catalog for ${locale}.`
      diagnostics.push(errorDiagnostic('I18N001', message, { locale }))
    }
  }
  return catalogs
}

function isFlatCatalog(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((item) => typeof item === 'string')
}

async function readFixtures(
  configDir: string,
  emailId: string,
  pattern: string,
  diagnostics: Diagnostic[],
): Promise<LoadedFixture[]> {
  const fixtures: LoadedFixture[] = []
  for await (const entry of glob(pattern, { cwd: configDir })) {
    if (entry.endsWith('.meta.json')) continue
    const file = path.resolve(configDir, entry)
    const id = path.basename(entry, '.json')
    const metaFile = file.replace(/\.json$/i, '.meta.json')
    try {
      const data: unknown = JSON.parse(await readFile(file, 'utf8'))
      const meta = parseMeta(JSON.parse(await readFile(metaFile, 'utf8')))
      if (!meta) {
        diagnostics.push(
          errorDiagnostic('CFG001', `Fixture ${id} has an invalid sidecar.`, { templateId: emailId, fixtureId: id }),
        )
        continue
      }
      fixtures.push({ id, file, data, meta, negative: meta.expect === 'invalid' })
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to read fixture ${id}.`
      diagnostics.push(errorDiagnostic('CFG001', message, { templateId: emailId, fixtureId: id }))
    }
  }
  return fixtures.sort((left, right) => left.id.localeCompare(right.id))
}

function checkLoadedFixtures(emailId: string, schema: ZodType, fixtures: readonly LoadedFixture[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const fixture of fixtures) {
    const issue = checkFixture(schema, fixture.data)
    if (fixture.negative) {
      if (!issue) {
        diagnostics.push(
          errorDiagnostic('DATA001', `Negative fixture ${fixture.id} was accepted by the schema.`, {
            templateId: emailId,
            fixtureId: fixture.id,
            origin: fixture.meta.origin,
          }),
        )
      }
      continue
    }
    if (issue) {
      diagnostics.push({ ...issue, templateId: emailId, fixtureId: fixture.id, origin: fixture.meta.origin })
    }
  }
  return diagnostics
}

function parseMeta(value: unknown): FixtureMeta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const allowed = new Set(['description', 'origin', 'event', 'purpose', 'expectedLocale', 'expect'])
  if (Object.keys(record).some((key) => !allowed.has(key))) return null
  if (
    typeof record.description !== 'string' ||
    typeof record.origin !== 'string' ||
    typeof record.event !== 'string' ||
    typeof record.purpose !== 'string'
  ) {
    return null
  }
  if (record.expectedLocale !== undefined && typeof record.expectedLocale !== 'string') return null
  const expect = record.expect ?? 'valid'
  if (expect !== 'valid' && expect !== 'invalid') return null
  return {
    description: record.description,
    origin: record.origin,
    event: record.event,
    purpose: record.purpose,
    expect,
    ...(typeof record.expectedLocale === 'string' ? { expectedLocale: record.expectedLocale } : {}),
  }
}

function readPayloadLocale(data: unknown, localePath: string): string | null {
  const parsed = parsePath(localePath, false)
  if (!parsed.ok) return null
  let cursor: unknown = data
  for (const segment of parsed.segments) {
    if (cursor === null || typeof cursor !== 'object') return null
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return typeof cursor === 'string' && cursor.length > 0 ? cursor : null
}

function readLocale(data: unknown, email: BuiltEmail): string | null {
  const value = readPayloadLocale(data, email.localePath)
  if (!value || !email.locales.includes(value)) return null
  return value
}

async function readManifest(file: string): Promise<ProjectManifest | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as ProjectManifest
    if (parsed.formatVersion !== 1 || !Array.isArray(parsed.emails)) return null
    return parsed
  } catch {
    return null
  }
}

function empty(exitCode: 1 | 2, diagnostics: Diagnostic[]): ProjectResult {
  return { ok: false, exitCode, diagnostics, manifest: null, emails: [], wrote: [], preserved: [] }
}

function recordEmittedEquality(
  profile: LoadedProfile,
  templateId: string,
  diagnostics: Diagnostic[],
  manifest: BuildManifest | null,
): BuildManifest | null {
  const eq = profile.emission.capabilities.find((item) => item.name === 'eq' && item.form === 'block')
  if (!eq) return manifest
  if (eq.evidence !== 'verified') {
    diagnostics.push(
      warningDiagnostic(
        'TARGET001',
        `Capability ${eq.name} is ${eq.evidence} and is not verified on the destination.`,
        { templateId },
      ),
    )
  }
  if (!manifest || manifest.capabilities.some((item) => item.name === eq.name)) return manifest
  return {
    ...manifest,
    capabilities: [...manifest.capabilities, { name: eq.name, evidence: eq.evidence, note: eq.note }],
  }
}

function localeInventory(
  previous: ProjectManifest | null,
  current: ProjectManifest,
  locale: string,
): ProjectManifest['emails'] {
  const prior = new Map((previous?.emails ?? []).map((email) => [email.id, email]))
  const seen = new Set<string>()
  const emails: ProjectManifest['emails'] = []
  for (const email of current.emails) {
    seen.add(email.id)
    const old = prior.get(email.id)
    const replacement = email.files.filter((file) => file.role === 'locale' && file.locale === locale)
    const kept = (old?.files ?? []).filter((file) => !(file.role === 'locale' && file.locale === locale))
    const files = [...kept, ...replacement]
    const hasMerged = files.some((file) => file.role === 'merged')
    emails.push({
      ...email,
      files,
      capabilities: mergeCapabilities(old?.capabilities ?? [], email.capabilities, hasMerged),
    })
  }
  for (const email of prior.values()) {
    if (!seen.has(email.id)) emails.push(email)
  }
  return emails
}

function mergeCapabilities(
  previous: ReadonlyArray<{ name: string; evidence: string }>,
  incoming: ReadonlyArray<{ name: string; evidence: string }>,
  hasMerged: boolean,
): Array<{ name: string; evidence: string }> {
  const map = new Map<string, { name: string; evidence: string }>()
  for (const item of [...previous, ...incoming]) {
    if (item.name === 'eq' && !hasMerged) continue
    map.set(item.name, item)
  }
  return [...map.values()]
}
