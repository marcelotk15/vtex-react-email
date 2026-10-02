import {
  errorDiagnostic,
  isSafeEmailId,
  parsePath,
  type Diagnostic,
  type EmailDefinition,
  type EmissionProfile,
  type LocalSimulator,
} from '@vtex-email/core'
import { glob } from 'node:fs/promises'
import path from 'node:path'

import type { ResolvedConfig } from '../config/config'
import type { LoadedProfile, ResolvedEmail } from './types'

import { loadEmailEntry } from './module-loader'

export async function discoverEmails(
  config: ResolvedConfig,
): Promise<{ ok: true; emails: ResolvedEmail[] } | { ok: false; diagnostics: Diagnostic[] }> {
  const files = await discoverFiles(config)
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
    const resolved = resolveEmail(config, definition, file, entry.dependencies)
    if (!resolved.ok) {
      diagnostics.push(...resolved.diagnostics)
      continue
    }
    emails.push(resolved.email)
  }
  const duplicate = duplicateId(emails.map((email) => email.definition.id))
  if (duplicate) diagnostics.push(errorDiagnostic('CFG001', `Duplicate email id: ${duplicate}`))
  if (diagnostics.length > 0) return { ok: false, diagnostics }
  return { ok: true, emails }
}

export function duplicateId(ids: readonly string[]): string | null {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return id
    seen.add(id)
  }
  return null
}

export function readProfile(module: Record<string, unknown>): LoadedProfile | null {
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
