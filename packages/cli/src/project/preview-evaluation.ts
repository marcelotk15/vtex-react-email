import {
  commitArtifacts,
  errorDiagnostic,
  evaluateArtifact,
  readPathValue,
  TemplateFailure,
  withForcedLocale,
  type Diagnostic,
} from '@vtex-email/core'
import path from 'node:path'

import { configuredOutputError } from '../config/config'
import { loadProjectConfig } from '../config/load-config'
import { buildProject, buildResolved } from './build-project'
import { checkLoadedFixtures, readFixtures } from './fixtures'
import { exitOk, exitUsage, exitValidation, type BuiltEmail, type PreviewResult, type ProjectResult } from './types'

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
  return previewFromBuild(built, input)
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
  const loaded = await loadProjectConfig(input.configPath)
  if (!loaded.ok) return previewFailure(exitUsage, loaded.diagnostics)
  const outputError = configuredOutputError(loaded.config, input.outDir)
  if (outputError) return previewFailure(exitUsage, [errorDiagnostic('CFG001', outputError)])
  const preview = previewFromBuild(
    await buildResolved(loaded.config, {
      onlyId: input.emailId,
      write: false,
      warningsAsErrors: input.warningsAsErrors,
    }),
    { emailId: input.emailId, fixtureId: input.fixtureId, mode: 'runtime' },
  )
  if (!preview.ok) return { ...preview, wrote: [] }
  const name = `${input.emailId}.${input.fixtureId}.html`
  await commitArtifacts(path.resolve(input.outDir), [{ name, content: preview.html }])
  return { ...preview, wrote: [name] }
}

function previewFromBuild(
  built: ProjectResult,
  input: { emailId: string; fixtureId: string; mode: 'runtime' | 'forced' | 'locale'; locale?: string },
): PreviewResult {
  if (!built.ok) return emptyPreview(built.exitCode, built.diagnostics)
  const email = built.emails.find((item) => item.id === input.emailId)
  if (!email) return emptyPreview(exitUsage, [errorDiagnostic('CFG001', `Unknown email: ${input.emailId}`)])
  return previewBuiltEmail({
    email,
    fixtureId: input.fixtureId,
    mode: input.mode,
    locale: input.locale,
  })
}

function previewFailure(exitCode: 1 | 2, diagnostics: Diagnostic[]): PreviewResult & { wrote: string[] } {
  return { ...emptyPreview(exitCode, diagnostics), wrote: [] }
}

function emptyPreview(exitCode: 0 | 1 | 2, diagnostics: Diagnostic[]): PreviewResult {
  return { ok: false, exitCode, html: '', source: '', diagnostics, selector: false, locale: '', payloadLocale: null }
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
    if (html.length > email.warnRenderedBytes)
      diagnostics.push(warningSize(email.id, html.length, email.warnRenderedBytes))
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

function readPayloadLocale(data: unknown, localePath: string): string | null {
  const value = readPathValue(data, localePath)
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readLocale(data: unknown, email: BuiltEmail): string | null {
  const value = readPayloadLocale(data, email.localePath)
  if (!value || !email.locales.includes(value)) return null
  return value
}
