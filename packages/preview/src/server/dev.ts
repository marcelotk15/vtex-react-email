import type { PreviewEndpoint } from './start-preview'

import { startPreview } from './start-preview'

export async function startDev(input: { configPath: string; warningsAsErrors?: boolean }): Promise<number> {
  const started = await startPreview(input)
  if (!started.ok) return started.exitCode
  process.stdout.write(`${started.url}\n`)
  await new Promise<void>((resolve) => {
    const stop = () => {
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      void started.close().then(
        () => resolve(),
        () => resolve(),
      )
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
  })
  return 0
}

export type { PreviewEndpoint }
