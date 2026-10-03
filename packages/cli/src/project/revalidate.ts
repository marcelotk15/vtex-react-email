import type { ZodType } from 'zod'

import { analyzePaths, analyzeRootPath, errorDiagnostic, type Diagnostic, type ScopeNode } from '@vtex-email/core'
import path from 'node:path'

import type { ResolvedConfig } from '../config/config'
import type { BuiltEmail, ResolvedEmail } from './types'

import { checkLoadedFixtures } from './fixtures'
import { importBundled } from './module-loader'
import { applyPolicy } from './policy'

export async function revalidateEmail(config: ResolvedConfig, email: BuiltEmail): Promise<BuiltEmail> {
  const fileKey = fileKeyFromPath(email.file)
  const diagnostics: Diagnostic[] = []
  const schemaResult = await loadSchema(config, fileKey, email.id, email.file)
  if (!schemaResult.ok) {
    return {
      ...email,
      diagnostics: applyPolicy(schemaResult.diagnostics, policyEmail(email, config)),
    }
  }
  const schema = schemaResult.schema
  analyzeContract(email.id, email.localePath, schema, email.structure, diagnostics)
  diagnostics.push(...checkLoadedFixtures(email.id, schema, email.fixtures))
  return {
    ...email,
    schema,
    diagnostics: applyPolicy(diagnostics, policyEmail(email, config)),
  }
}

async function loadSchema(
  config: ResolvedConfig,
  fileKey: string,
  templateId: string,
  _emailFile: string,
): Promise<{ ok: true; schema: ZodType } | { ok: false; diagnostics: Diagnostic[] }> {
  const schemaFile = path.resolve(config.configDir, config.schemasDir, `${fileKey}.ts`)
  const relative = toPosix(path.relative(config.configDir, schemaFile))
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
      diagnostics: [
        errorDiagnostic('CFG001', message, {
          source: { file: schemaFile },
          templateId,
        }),
      ],
    }
  }
}

function analyzeContract(
  templateId: string,
  localePath: string,
  schema: ZodType,
  structure: ScopeNode[],
  diagnostics: Diagnostic[],
): void {
  diagnostics.push(
    ...analyzePaths(schema, structure).map((issue) => ({
      ...issue,
      templateId,
    })),
  )
  const localeIssue = analyzeRootPath(schema, localePath)
  if (localeIssue) diagnostics.push({ ...localeIssue, templateId, path: localePath })
}

function policyEmail(email: BuiltEmail, config: ResolvedConfig): ResolvedEmail {
  return {
    definition: {
      id: email.id,
      event: email.event,
      template: () => null,
      schema: email.schema,
      fixtures: email.fixturesPattern,
      i18n: {
        locales: email.locales,
        defaultLocale: email.defaultLocale,
        localePath: email.localePath,
        output: email.output,
      },
    },
    file: email.file,
    fileKey: fileKeyFromPath(email.file),
    dependencies: email.dependencies,
    locales: email.locales,
    defaultLocale: email.defaultLocale,
    localePath: email.localePath,
    output: email.output,
    aliases: [],
    unknownPath: config.validation.unknownPath,
    warningsAsErrors: config.validation.warningsAsErrors,
    unverifiedCapability: config.validation.unverifiedCapability,
  }
}

function fileKeyFromPath(file: string): string {
  const base = path.basename(file)
  if (!base.endsWith('.email.tsx')) return path.basename(file, path.extname(file))
  return base.slice(0, -'.email.tsx'.length)
}

function isZodType(value: unknown): value is ZodType {
  return !!value && typeof value === 'object' && 'safeParse' in value
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/')
}
