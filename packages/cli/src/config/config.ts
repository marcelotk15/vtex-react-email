import type { CompileEmailInput } from '@vtex-email/react'

import { errorDiagnostic, type Diagnostic } from '@vtex-email/core'
import path from 'node:path'
import { z } from 'zod'

const defaults = {
  validation: {
    unknownPath: 'error',
    unverifiedCapability: 'error',
    warningsAsErrors: false,
  },
  compatibility: {
    policy: 'conservative',
    maxSourceBytes: 250_000,
    warnRenderedBytes: 90_000,
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
  },
} as const

const ConfigSchema = z.strictObject({
  emails: z.array(z.string().min(1)).min(1),
  outDir: z.string().min(1),
  target: z.strictObject({
    profile: z.string().min(1),
  }),
  i18n: z.strictObject({
    locales: z.array(z.string().min(1)).min(1),
    defaultLocale: z.string().min(1),
    catalogs: z.string().min(1),
    missingKey: z.literal('error'),
  }),
  tailwind: z.custom<CompileEmailInput['tailwind']>(
    (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
  ),
  validation: z
    .strictObject({
      unknownPath: z.enum(['error', 'warning']),
      unverifiedCapability: z.enum(['error', 'warning']),
      warningsAsErrors: z.boolean(),
    })
    .optional(),
  compatibility: z
    .strictObject({
      policy: z.literal('conservative'),
      maxSourceBytes: z.number().int().positive(),
      warnRenderedBytes: z.number().int().positive(),
    })
    .optional(),
  preview: z
    .strictObject({
      host: z.string().min(1),
      port: z.number().int().positive(),
    })
    .optional(),
})

export interface ProjectConfig extends z.infer<typeof ConfigSchema> {}

export interface ResolvedConfig {
  configDir: string
  emails: string[]
  outDir: string
  profilePath: string
  locales: string[]
  defaultLocale: string
  catalogs: string
  tailwind: CompileEmailInput['tailwind']
  validation: {
    unknownPath: 'error' | 'warning'
    unverifiedCapability: 'error' | 'warning'
    warningsAsErrors: boolean
  }
  compatibility: {
    policy: 'conservative'
    maxSourceBytes: number
    warnRenderedBytes: number
  }
  preview: {
    host: string
    port: number
  }
}

export function defineConfig<T extends ProjectConfig>(config: T): T {
  return config
}

export function validateConfig(
  value: unknown,
  configDir: string,
): { ok: true; config: ResolvedConfig } | { ok: false; diagnostics: Diagnostic[] } {
  const parsed = ConfigSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: parsed.error.issues.map((issue) =>
        errorDiagnostic('CFG001', issue.message, {
          path: issue.path.join('.'),
        }),
      ),
    }
  }
  if (!parsed.data.i18n.locales.includes(parsed.data.i18n.defaultLocale)) {
    return { ok: false, diagnostics: [errorDiagnostic('CFG001', 'defaultLocale must be one of locales.')] }
  }
  const outDir = path.resolve(configDir, parsed.data.outDir)
  const sourceDirs = [staticRoot(parsed.data.emails[0] ?? 'emails'), staticRoot(parsed.data.i18n.catalogs), 'fixtures']
  const outputError = outputDirectoryError(configDir, outDir, sourceDirs)
  if (outputError) return { ok: false, diagnostics: [errorDiagnostic('CFG001', outputError)] }
  return {
    ok: true,
    config: {
      configDir,
      emails: parsed.data.emails,
      outDir,
      profilePath: path.resolve(configDir, parsed.data.target.profile),
      locales: parsed.data.i18n.locales,
      defaultLocale: parsed.data.i18n.defaultLocale,
      catalogs: parsed.data.i18n.catalogs,
      tailwind: parsed.data.tailwind,
      validation: { ...defaults.validation, ...parsed.data.validation },
      compatibility: { ...defaults.compatibility, ...parsed.data.compatibility },
      preview: { ...defaults.preview, ...parsed.data.preview },
    },
  }
}

function staticRoot(pattern: string): string {
  const normalized = pattern.replaceAll('\\', '/')
  const [first] = normalized.split('/')
  if (!first || first.includes('*')) return ''
  return first
}

export function configuredOutputError(config: ResolvedConfig, candidate: string): string | null {
  const outDir = path.resolve(candidate)
  if (outDir === config.outDir) return 'outDir cannot be the project output directory.'
  return outputDirectoryError(config.configDir, outDir, [
    staticRoot(config.emails[0] ?? 'emails'),
    staticRoot(config.catalogs),
    'fixtures',
  ])
}

export function outputDirectoryError(configDir: string, outDir: string, sourceDirs: readonly string[]): string | null {
  const relativeToOutput = path.relative(outDir, configDir)
  if (relativeToOutput === '' || (!relativeToOutput.startsWith('..') && !path.isAbsolute(relativeToOutput))) {
    return 'outDir cannot be the project root or an ancestor of it.'
  }
  for (const source of sourceDirs) {
    if (source.length === 0) continue
    if (path.resolve(configDir, source) === outDir) return 'outDir cannot be a source directory.'
  }
  return null
}
