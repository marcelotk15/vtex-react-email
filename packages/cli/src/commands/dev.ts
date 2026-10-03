import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import type { DevNoticeHandler } from './dev-notices'
import { createDevPresenter } from './dev-presenter'
import { exitUsage } from '../project/types'
import { usageReport } from './project-commands'
import { emitReport } from './report'

export async function startDevCommand(
  configPath: string,
  configDir: string,
  options: { warningsAsErrors: boolean; format: 'text' | 'json'; version: string },
): Promise<number> {
  const presenter = createDevPresenter({
    version: options.version,
    format: options.format,
  })
  try {
    const require = createRequire(configPath)
    const resolved = require.resolve('@vtex-email/preview')
    const imported = (await import(pathToFileURL(resolved).href)) as {
      startDev?: (input: {
        configPath: string
        warningsAsErrors?: boolean
        onNotice?: DevNoticeHandler
      }) => Promise<number>
    }
    if (!imported.startDev) throw new Error('The preview package does not export startDev.')
    await presenter.printBanner()
    return await imported.startDev({
      configPath,
      onNotice: (notice) => presenter.handle(notice),
      ...(options.warningsAsErrors ? { warningsAsErrors: true } : {}),
    })
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    const missing = code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND'
    const message = missing
      ? 'The preview package is not installed for this project.'
      : error instanceof Error
        ? error.message
        : 'Failed to start the preview.'
    await emitReport(usageReport(message, configDir), options.format)
    return exitUsage
  }
}
