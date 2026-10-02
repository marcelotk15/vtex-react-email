import path from 'node:path'

import { exportPreview } from '../project/preview-evaluation'
import { buildReport, emitReport } from './report'

export async function runPreviewExport(
  configPath: string,
  configDir: string,
  cwd: string,
  options: {
    emailId: string
    fixtureId: string
    outDir: string
    warningsAsErrors: boolean
    format: 'text' | 'json'
  },
): Promise<number> {
  const preview = await exportPreview({
    configPath,
    emailId: options.emailId,
    fixtureId: options.fixtureId,
    outDir: path.resolve(cwd, options.outDir),
    ...(options.warningsAsErrors ? { warningsAsErrors: true } : {}),
  })
  await emitReport(
    buildReport({
      command: 'preview',
      ok: preview.ok,
      exitCode: preview.exitCode,
      diagnostics: preview.diagnostics,
      manifest: null,
      wrote: preview.wrote,
      preserved: [],
      configDir,
    }),
    options.format,
  )
  return preview.exitCode
}
