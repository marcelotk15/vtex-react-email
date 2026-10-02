import { buildProject, validateProject } from '../project/build-project'
import { exitUsage, type ProjectResult } from '../project/types'
import { buildReport, emitReport, type CliReport } from './report'

export async function runProjectCommand(
  kind: 'build' | 'validate',
  configPath: string,
  configDir: string,
  options: { warningsAsErrors?: boolean; emailId?: string; locale?: string; format: 'text' | 'json' },
): Promise<number> {
  const result =
    kind === 'validate'
      ? await validateProject({
          configPath,
          ...(options.warningsAsErrors ? { warningsAsErrors: true } : {}),
        })
      : await buildProject({
          configPath,
          ...(options.emailId ? { onlyId: options.emailId } : {}),
          ...(options.locale ? { locale: options.locale } : {}),
          ...(options.warningsAsErrors ? { warningsAsErrors: true } : {}),
        })
  await emitReport(projectReport(kind, result, configDir), options.format)
  return result.exitCode
}

export function usageReport(message: string, configDir: string): CliReport {
  return buildReport({
    command: 'usage',
    ok: false,
    exitCode: exitUsage,
    diagnostics: [{ code: 'CFG001', severity: 'error', message }],
    manifest: null,
    wrote: [],
    preserved: [],
    configDir,
  })
}

function projectReport(command: 'build' | 'validate', result: ProjectResult, configDir: string): CliReport {
  return buildReport({
    command,
    ok: result.ok,
    exitCode: result.exitCode,
    diagnostics: result.diagnostics,
    manifest: result.manifest,
    wrote: result.wrote,
    preserved: result.preserved,
    configDir,
  })
}
