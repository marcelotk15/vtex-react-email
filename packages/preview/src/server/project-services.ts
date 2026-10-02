import {
  buildProject,
  loadProjectConfig,
  previewBuiltEmail,
  publishDiagnostics,
  refreshEmailFixtures,
  type BuiltEmail,
  type PreviewResult,
  type ProjectResult,
  type ResolvedConfig,
} from '@vtex-email/cli'
import path from 'node:path'

import type { PreviewServices } from '../session/session'

import { emailRoot, type SessionPaths } from '../session/change-plan'

export function previewPaths(config: ResolvedConfig, configPath: string): SessionPaths {
  return {
    configDir: config.configDir,
    configFile: configPath,
    profilePath: config.profilePath,
    catalogFiles: config.locales.map((locale) =>
      path.resolve(config.configDir, config.catalogs.replaceAll('{locale}', locale)),
    ),
    emailRoots: config.emails
      .map((pattern) => emailRoot(pattern))
      .filter((root) => root.length > 0)
      .map((root) => path.resolve(config.configDir, root)),
  }
}

export function loadPreviewConfig(
  configPath: string,
): Promise<{ ok: true; config: ResolvedConfig } | { ok: false; diagnostics: ProjectResult['diagnostics'] }> {
  return loadProjectConfig(configPath)
}

export function createProjectServices(input: {
  configPath: string
  configDir: string
  warningsAsErrors: boolean
}): PreviewServices {
  return {
    compile: async (emailIds) =>
      presentResult(
        await compileProject(input.configPath, input.warningsAsErrors, emailIds),
        input.configDir,
        emailIds,
      ),
    refreshFixtures: async (email) => presentEmail(await refreshEmailFixtures(email, input.configDir), input.configDir),
    evaluate: (request) => presentPreview(previewBuiltEmail(request), input.configDir),
  }
}

export async function compilePreviewProject(configPath: string, warningsAsErrors: boolean): Promise<ProjectResult> {
  return buildProject({
    configPath,
    write: false,
    ...(warningsAsErrors ? { warningsAsErrors: true } : {}),
  })
}

export function presentCompiled(result: ProjectResult, configDir: string): ProjectResult {
  return presentResult(result, configDir)
}

async function compileProject(
  configPath: string,
  warningsAsErrors: boolean,
  emailIds: readonly string[] | null,
): Promise<ProjectResult> {
  const options = warningsAsErrors ? { warningsAsErrors: true as const } : {}
  if (emailIds === null) return buildProject({ configPath, write: false, ...options })
  const results: ProjectResult[] = []
  for (const id of emailIds) {
    results.push(await buildProject({ configPath, onlyId: id, write: false, ...options }))
  }
  if (results.length === 1 && results[0]) return results[0]
  const ok = results.every((result) => result.ok)
  return {
    ok,
    exitCode: results.some((result) => result.exitCode === 2) ? 2 : ok ? 0 : 1,
    diagnostics: results.flatMap((result) => result.diagnostics),
    manifest: null,
    emails: results.flatMap((result) => result.emails),
    wrote: [],
    preserved: [],
  }
}

function presentResult(
  result: ProjectResult,
  configDir: string,
  requestedIds: readonly string[] | null = null,
): ProjectResult {
  const removedEmailIds =
    requestedIds === null
      ? result.removedEmailIds
      : requestedIds.filter(
          (id) =>
            !result.emails.some((email) => email.id === id) &&
            result.diagnostics.some((item) => item.code === 'CFG001' && item.message === `Unknown email: ${id}`),
        )
  return {
    ...result,
    diagnostics: publishDiagnostics(result.diagnostics, configDir),
    emails: result.emails.map((email) => presentEmail(email, configDir)),
    ...(removedEmailIds && removedEmailIds.length > 0 ? { removedEmailIds: [...removedEmailIds] } : {}),
  }
}

function presentEmail(email: BuiltEmail, configDir: string): BuiltEmail {
  return { ...email, diagnostics: publishDiagnostics(email.diagnostics, configDir) }
}

async function presentPreview(
  result: PreviewResult | Promise<PreviewResult>,
  configDir: string,
): Promise<PreviewResult> {
  const resolved = await result
  return { ...resolved, diagnostics: publishDiagnostics(resolved.diagnostics, configDir) }
}
