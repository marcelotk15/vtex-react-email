import { errorDiagnostic, type Diagnostic } from '@vtex-email/core'
import path from 'node:path'

import { importBundled } from '../project/module-loader'
import { validateConfig, type ResolvedConfig } from './config'

export async function loadProjectConfig(
  configPath: string,
): Promise<{ ok: true; config: ResolvedConfig } | { ok: false; diagnostics: Diagnostic[] }> {
  const configDir = path.dirname(configPath)
  let loaded: Record<string, unknown>
  try {
    loaded = await importBundled(configPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the config.'
    return { ok: false, diagnostics: [errorDiagnostic('CFG001', message, { source: { file: configPath } })] }
  }
  return validateConfig(loaded.default, configDir)
}
