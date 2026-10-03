import type { DevNoticeHandler } from '@vtex-email/cli/project'

import type { PreviewEndpoint } from './start-preview'

import { startPreview } from './start-preview'

export async function startDev(input: {
  configPath: string
  warningsAsErrors?: boolean
  onNotice?: DevNoticeHandler
}): Promise<number> {
  const started = await startPreview(input)
  if (!started.ok) return started.exitCode
  await new Promise<void>((resolve) => {
    let settling = false
    const stop = () => {
      if (settling) return
      settling = true
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      void started
        .close()
        .catch(() => undefined)
        .finally(() => {
          void Promise.resolve(input.onNotice?.({ kind: 'stopped' })).finally(() => resolve())
        })
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
  })
  return 0
}

export type { PreviewEndpoint }
