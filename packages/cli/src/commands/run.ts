import path from 'node:path'

import { exitOk, exitUsage } from '../project/types'
import { helpText, type ParsedArgs } from './args'
import { startDevCommand } from './dev'
import { runPreviewExport } from './preview-export'
import { runProjectCommand, usageReport } from './project-commands'
import { emitReport, writeStream } from './report'

export async function run(args: ParsedArgs, cwd: string, version: string): Promise<number> {
  if (args.kind === 'help') {
    await writeStream(process.stdout, helpText())
    return exitOk
  }
  if (args.kind === 'version') {
    await writeStream(process.stdout, `${version}\n`)
    return exitOk
  }
  const configPath = path.resolve(cwd, args.config ?? 'vtex-email.config.ts')
  const configDir = path.dirname(configPath)
  if (args.kind === 'dev') {
    return startDevCommand(configPath, configDir, {
      warningsAsErrors: args.warningsAsErrors,
      format: args.format,
    })
  }
  if (args.kind === 'error') {
    await emitReport(usageReport(args.message, configDir), args.format)
    return exitUsage
  }
  if (args.kind === 'preview') {
    return runPreviewExport(configPath, configDir, cwd, {
      emailId: args.emailId,
      fixtureId: args.fixtureId,
      outDir: args.outDir,
      warningsAsErrors: args.warningsAsErrors,
      format: args.format,
    })
  }
  return runProjectCommand(args.kind, configPath, configDir, {
    format: args.format,
    warningsAsErrors: args.warningsAsErrors,
    ...(args.kind === 'build' && args.emailId ? { emailId: args.emailId } : {}),
    ...(args.kind === 'build' && args.locale ? { locale: args.locale } : {}),
  })
}
