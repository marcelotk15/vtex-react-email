import type { ZodType } from 'zod'

import {
  errorDiagnostic,
  isSafeEmailId,
  parsePath,
  type Diagnostic,
  type EmailDefinition,
  type EmailSettings,
} from '@vtex-email/core'
import { access, glob } from 'node:fs/promises'
import path from 'node:path'

import type { ResolvedConfig } from '../config/config'
import type { ResolvedEmail } from './types'

import { importBundled, loadEmailEntry } from './module-loader'
import { parseEmailSettings } from './settings'

const TEMPLATE_SUFFIX = '.email.tsx'

export async function discoverEmails(
  config: ResolvedConfig,
): Promise<{ ok: true; emails: ResolvedEmail[] } | { ok: false; diagnostics: Diagnostic[] }> {
  const files = await discoverFiles(config)
  const emails: ResolvedEmail[] = []
  const diagnostics: Diagnostic[] = []
  const fileKeys = new Map<string, string>()
  for (const file of files) {
    const fileKey = fileKeyFromPath(file)
    if (!fileKey) {
      diagnostics.push(errorDiagnostic('CFG001', `Email file must end with ${TEMPLATE_SUFFIX}.`, { source: { file } }))
      continue
    }
    if (!isSafeEmailId(fileKey)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Invalid email file key: ${fileKey}`, { source: { file }, templateId: fileKey }),
      )
      continue
    }
    const previous = fileKeys.get(fileKey)
    if (previous) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Duplicate email file key: ${fileKey}`, {
          source: { file },
          templateId: fileKey,
        }),
      )
      continue
    }
    fileKeys.set(fileKey, file)

    const entry = await loadEmailEntry(file)
    if (!entry.ok) {
      diagnostics.push(...entry.diagnostics)
      continue
    }
    const template = entry.module.default
    if (typeof template !== 'function') {
      diagnostics.push(
        errorDiagnostic(
          'CFG001',
          'The email module must default-export a React component. Optional overrides go in export const settings.',
          { source: { file } },
        ),
      )
      continue
    }
    const settingsResult = parseEmailSettings(entry.module.settings, file)
    if (!settingsResult.ok) {
      diagnostics.push(...settingsResult.diagnostics)
      continue
    }
    const resolved = await resolveEmail(
      config,
      fileKey,
      template as () => unknown,
      settingsResult.settings,
      file,
      entry.dependencies,
    )
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

export function fileKeyFromPath(file: string): string | null {
  const base = path.basename(file)
  if (!base.endsWith(TEMPLATE_SUFFIX)) return null
  return base.slice(0, -TEMPLATE_SUFFIX.length)
}

export function schemaPathForKey(config: ResolvedConfig, fileKey: string): string {
  return path.resolve(config.configDir, config.schemasDir, `${fileKey}.ts`)
}

export function duplicateId(ids: readonly string[]): string | null {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return id
    seen.add(id)
  }
  return null
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

async function resolveEmail(
  config: ResolvedConfig,
  fileKey: string,
  template: () => unknown,
  settings: EmailSettings,
  file: string,
  dependencies: string[],
): Promise<{ ok: true; email: ResolvedEmail } | { ok: false; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = []
  const id = settings.id ?? fileKey
  const event = settings.event ?? fileKey
  if (!isSafeEmailId(id)) {
    diagnostics.push(errorDiagnostic('CFG001', `Invalid email id: ${id}`, { source: { file }, templateId: id }))
  }

  const schemaResult = await resolveSchema(config, fileKey, settings.schema, id, file)
  if (!schemaResult.ok) diagnostics.push(...schemaResult.diagnostics)

  const localePath = settings.i18n?.localePath ?? config.localePath
  if (!localePath) {
    diagnostics.push(
      errorDiagnostic(
        'CFG001',
        `Missing localePath. Set i18n.localePath in defineConfig or settings.i18n.localePath for "${fileKey}".`,
        { source: { file }, templateId: id },
      ),
    )
  } else if (!parsePath(localePath, true).ok) {
    diagnostics.push(
      errorDiagnostic('CFG001', `Invalid locale path: ${localePath}`, { source: { file }, templateId: id }),
    )
  }

  const locales = [...(settings.i18n?.locales ?? config.locales)]
  for (const locale of locales) {
    if (!config.locales.includes(locale)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Locale ${locale} is not enabled by the project.`, {
          source: { file },
          templateId: id,
        }),
      )
    }
  }
  const defaultLocale = settings.i18n?.defaultLocale ?? config.defaultLocale
  if (!locales.includes(defaultLocale)) {
    diagnostics.push(
      errorDiagnostic('CFG001', 'The email default locale is not in its locale list.', {
        source: { file },
        templateId: id,
      }),
    )
  }
  const aliases = Object.entries(settings.i18n?.aliases ?? {}).map(([alias, locale]) => ({ alias, locale }))
  for (const alias of aliases) {
    if (!locales.includes(alias.locale)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Alias ${alias.alias} points at an unknown locale.`, {
          source: { file },
          templateId: id,
        }),
      )
    }
  }

  const fixturesRelative = settings.fixtures ?? path.posix.join(toPosix(config.fixturesDir), fileKey)

  if (diagnostics.length > 0 || !schemaResult.ok || !localePath) {
    return { ok: false, diagnostics }
  }

  const definition: EmailDefinition<() => unknown> = {
    id,
    event,
    template,
    schema: schemaResult.schema,
    fixtures: fixturesRelative,
    i18n: {
      locales,
      defaultLocale,
      localePath,
      output: settings.i18n?.output ?? 'merged',
      ...(settings.i18n?.aliases ? { aliases: settings.i18n.aliases } : {}),
    },
    ...(settings.validation ? { validation: settings.validation } : {}),
  }

  return {
    ok: true,
    email: {
      definition,
      file,
      fileKey,
      dependencies,
      locales,
      defaultLocale,
      localePath,
      output: definition.i18n.output ?? 'merged',
      aliases,
      unknownPath: settings.validation?.unknownPath ?? config.validation.unknownPath,
      warningsAsErrors: settings.validation?.warningsAsErrors ?? config.validation.warningsAsErrors,
      unverifiedCapability: config.validation.unverifiedCapability,
    },
  }
}

async function resolveSchema(
  config: ResolvedConfig,
  fileKey: string,
  override: ZodType | undefined,
  templateId: string,
  emailFile: string,
): Promise<{ ok: true; schema: ZodType } | { ok: false; diagnostics: Diagnostic[] }> {
  if (override) return { ok: true, schema: override }

  const schemaFile = schemaPathForKey(config, fileKey)
  const relative = toPosix(path.relative(config.configDir, schemaFile))
  if (!(await exists(schemaFile))) {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic(
          'CFG001',
          `No schema for file key "${fileKey}". Add ${relative} with export default Zod schema, or set settings.schema.`,
          { source: { file: emailFile }, templateId },
        ),
      ],
    }
  }

  try {
    const module = await importBundled(schemaFile)
    if (!isZodType(module.default)) {
      return {
        ok: false,
        diagnostics: [
          errorDiagnostic('CFG001', `Schema module ${relative} must default-export a Zod schema.`, {
            source: { file: schemaFile },
            templateId,
          }),
        ],
      }
    }
    return { ok: true, schema: module.default }
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to load schema ${relative}.`
    return {
      ok: false,
      diagnostics: [errorDiagnostic('CFG001', message, { source: { file: schemaFile }, templateId })],
    }
  }
}

function isZodType(value: unknown): value is ZodType {
  return !!value && typeof value === 'object' && 'safeParse' in value
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/')
}
