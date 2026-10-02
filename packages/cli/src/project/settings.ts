import { errorDiagnostic, type Diagnostic, type EmailSettings } from '@vtex-email/core'
import type { ZodType } from 'zod'

const OUTPUTS = new Set(['per-locale', 'merged'])
const UNKNOWN_PATH = new Set(['error', 'warning'])

export function parseEmailSettings(
  value: unknown,
  file: string,
): { ok: true; settings: EmailSettings } | { ok: false; diagnostics: Diagnostic[] } {
  if (value === undefined) return { ok: true, settings: {} }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      diagnostics: [
        errorDiagnostic('CFG001', 'export const settings must be an object.', { source: { file } }),
      ],
    }
  }
  const record = value as Record<string, unknown>
  const allowed = new Set(['id', 'event', 'schema', 'fixtures', 'i18n', 'validation'])
  const diagnostics: Diagnostic[] = []
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Unknown settings field: ${key}`, { source: { file }, path: key }),
      )
    }
  }
  if (record.id !== undefined && typeof record.id !== 'string') {
    diagnostics.push(errorDiagnostic('CFG001', 'settings.id must be a string.', { source: { file }, path: 'id' }))
  }
  if (record.event !== undefined && typeof record.event !== 'string') {
    diagnostics.push(errorDiagnostic('CFG001', 'settings.event must be a string.', { source: { file }, path: 'event' }))
  }
  if (record.fixtures !== undefined && (typeof record.fixtures !== 'string' || record.fixtures.length === 0)) {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.fixtures must be a non-empty string.', {
        source: { file },
        path: 'fixtures',
      }),
    )
  }
  if (record.schema !== undefined && !isZodType(record.schema)) {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.schema must be a Zod schema.', { source: { file }, path: 'schema' }),
    )
  }
  const i18n = parseI18n(record.i18n, file, diagnostics)
  const validation = parseValidation(record.validation, file, diagnostics)
  if (diagnostics.length > 0) return { ok: false, diagnostics }
  const settings: EmailSettings = {
    ...(typeof record.id === 'string' ? { id: record.id } : {}),
    ...(typeof record.event === 'string' ? { event: record.event } : {}),
    ...(typeof record.fixtures === 'string' ? { fixtures: record.fixtures } : {}),
    ...(isZodType(record.schema) ? { schema: record.schema as ZodType } : {}),
    ...(i18n ? { i18n } : {}),
    ...(validation ? { validation } : {}),
  }
  return { ok: true, settings }
}

function parseI18n(
  value: unknown,
  file: string,
  diagnostics: Diagnostic[],
): EmailSettings['i18n'] | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.i18n must be an object.', { source: { file }, path: 'i18n' }),
    )
    return undefined
  }
  const record = value as Record<string, unknown>
  const allowed = new Set(['locales', 'defaultLocale', 'localePath', 'output', 'aliases'])
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Unknown settings.i18n field: ${key}`, {
          source: { file },
          path: `i18n.${key}`,
        }),
      )
    }
  }
  if (record.locales !== undefined) {
    if (!Array.isArray(record.locales) || record.locales.length === 0 || record.locales.some((item) => typeof item !== 'string')) {
      diagnostics.push(
        errorDiagnostic('CFG001', 'settings.i18n.locales must be a non-empty string array.', {
          source: { file },
          path: 'i18n.locales',
        }),
      )
    }
  }
  if (record.defaultLocale !== undefined && typeof record.defaultLocale !== 'string') {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.i18n.defaultLocale must be a string.', {
        source: { file },
        path: 'i18n.defaultLocale',
      }),
    )
  }
  if (record.localePath !== undefined && typeof record.localePath !== 'string') {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.i18n.localePath must be a string.', {
        source: { file },
        path: 'i18n.localePath',
      }),
    )
  }
  if (record.output !== undefined && (typeof record.output !== 'string' || !OUTPUTS.has(record.output))) {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.i18n.output must be "per-locale" or "merged".', {
        source: { file },
        path: 'i18n.output',
      }),
    )
  }
  if (record.aliases !== undefined) {
    if (!record.aliases || typeof record.aliases !== 'object' || Array.isArray(record.aliases)) {
      diagnostics.push(
        errorDiagnostic('CFG001', 'settings.i18n.aliases must be an object.', {
          source: { file },
          path: 'i18n.aliases',
        }),
      )
    } else {
      for (const [alias, locale] of Object.entries(record.aliases as Record<string, unknown>)) {
        if (typeof locale !== 'string') {
          diagnostics.push(
            errorDiagnostic('CFG001', `settings.i18n.aliases.${alias} must be a string.`, {
              source: { file },
              path: `i18n.aliases.${alias}`,
            }),
          )
        }
      }
    }
  }
  return {
    ...(Array.isArray(record.locales) ? { locales: record.locales as string[] } : {}),
    ...(typeof record.defaultLocale === 'string' ? { defaultLocale: record.defaultLocale } : {}),
    ...(typeof record.localePath === 'string' ? { localePath: record.localePath } : {}),
    ...(typeof record.output === 'string' && OUTPUTS.has(record.output)
      ? { output: record.output as 'per-locale' | 'merged' }
      : {}),
    ...(record.aliases && typeof record.aliases === 'object' && !Array.isArray(record.aliases)
      ? { aliases: record.aliases as Record<string, string> }
      : {}),
  }
}

function parseValidation(
  value: unknown,
  file: string,
  diagnostics: Diagnostic[],
): EmailSettings['validation'] | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.validation must be an object.', {
        source: { file },
        path: 'validation',
      }),
    )
    return undefined
  }
  const record = value as Record<string, unknown>
  const allowed = new Set(['unknownPath', 'warningsAsErrors'])
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Unknown settings.validation field: ${key}`, {
          source: { file },
          path: `validation.${key}`,
        }),
      )
    }
  }
  if (
    record.unknownPath !== undefined &&
    (typeof record.unknownPath !== 'string' || !UNKNOWN_PATH.has(record.unknownPath))
  ) {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.validation.unknownPath must be "error" or "warning".', {
        source: { file },
        path: 'validation.unknownPath',
      }),
    )
  }
  if (record.warningsAsErrors !== undefined && typeof record.warningsAsErrors !== 'boolean') {
    diagnostics.push(
      errorDiagnostic('CFG001', 'settings.validation.warningsAsErrors must be a boolean.', {
        source: { file },
        path: 'validation.warningsAsErrors',
      }),
    )
  }
  return {
    ...(typeof record.unknownPath === 'string' && UNKNOWN_PATH.has(record.unknownPath)
      ? { unknownPath: record.unknownPath as 'error' | 'warning' }
      : {}),
    ...(typeof record.warningsAsErrors === 'boolean' ? { warningsAsErrors: record.warningsAsErrors } : {}),
  }
}

function isZodType(value: unknown): value is ZodType {
  return !!value && typeof value === 'object' && 'safeParse' in value
}
