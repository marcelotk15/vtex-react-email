import { createServer, type Server, type ServerResponse } from 'node:http'
import path from 'node:path'

import { buildPreviewAssets } from '../assets/build-assets'
import { samePath } from '../session/change-plan'
import { createPreviewSession } from '../session/session'
import { broadcast } from './event-stream'
import { handleRequest } from './http-routes'
import {
  compilePreviewProject,
  createProjectServices,
  loadPreviewConfig,
  presentCompiled,
  previewPaths,
} from './project-services'
import { DEBOUNCE_MS, watchProject } from './watch'

export interface PreviewEndpoint {
  ok: true
  url: string
  close(): Promise<void>
}

export interface PreviewStartupFailure {
  ok: false
  exitCode: 1 | 2
  diagnostics: Awaited<ReturnType<typeof compilePreviewProject>>['diagnostics']
}

export async function startPreview(input: {
  configPath: string
  warningsAsErrors?: boolean
  host?: string
  port?: number
}): Promise<PreviewEndpoint | PreviewStartupFailure> {
  const configPath = path.resolve(input.configPath)
  const loaded = await loadPreviewConfig(configPath)
  if (!loaded.ok) return { ok: false, exitCode: 2, diagnostics: loaded.diagnostics }
  const warnings = input.warningsAsErrors === true
  const assetsPromise = buildPreviewAssets().then(
    (bundle) => ({ ok: true as const, bundle }),
    (error: unknown) => ({
      ok: false as const,
      message: error instanceof Error ? error.message : 'Failed to build the preview interface.',
    }),
  )
  const built = await compilePreviewProject(configPath, warnings)
  if (!built.ok && built.exitCode === 2) return { ok: false, exitCode: 2, diagnostics: built.diagnostics }
  const assets = await assetsPromise
  if (!assets.ok) {
    return {
      ok: false,
      exitCode: 1,
      diagnostics: [{ code: 'CFG001', severity: 'error', message: assets.message }],
    }
  }
  const bundle = assets.bundle
  const presented = presentCompiled(built, loaded.config.configDir)
  const paths = previewPaths(loaded.config, configPath)
  const session = createPreviewSession({
    paths,
    emails: presented.emails,
    diagnostics: presented.diagnostics,
    ok: presented.ok,
    services: createProjectServices({
      configPath,
      configDir: loaded.config.configDir,
      warningsAsErrors: warnings,
    }),
  })
  await session.open()

  const hostLocked = input.host !== undefined
  const portLocked = input.port !== undefined
  let host = input.host ?? loaded.config.preview.host
  let port = input.port ?? loaded.config.preview.port
  let profilePath = loaded.config.profilePath
  let server: Server | null = null
  let url = ''
  const clients = new Set<ServerResponse>()
  let watchGeneration = 0
  let stopped = false

  const unsubscribe = session.subscribe((state) => {
    broadcast(clients, state)
  })

  try {
    const bound = await listen(host, port)
    server = bound.server
    url = bound.url
    port = bound.port
  } catch (error) {
    unsubscribe()
    session.close()
    const message = error instanceof Error ? error.message : 'Failed to open the preview server.'
    return { ok: false, exitCode: 1, diagnostics: [{ code: 'CFG001', severity: 'error', message }] }
  }

  const watcher = watchProject(loaded.config.configDir, DEBOUNCE_MS, (files) => {
    void onFiles(files)
  })

  return {
    ok: true,
    get url() {
      return url
    },
    close,
  }

  async function onFiles(files: readonly string[]): Promise<void> {
    const token = ++watchGeneration
    await session.ingest(files)
    if (stopped || token !== watchGeneration) return
    if (hostLocked && portLocked) return
    if (!files.some((file) => samePath(file, configPath) || samePath(file, profilePath))) return
    const next = await loadPreviewConfig(configPath)
    if (!next.ok || stopped || token !== watchGeneration) return
    profilePath = next.config.profilePath
    session.updatePaths(previewPaths(next.config, configPath))
    const nextHost = hostLocked ? host : next.config.preview.host
    const nextPort = portLocked ? port : next.config.preview.port
    if (nextHost === host && nextPort === port) return
    try {
      const bound = await listen(nextHost, nextPort)
      host = nextHost
      port = bound.port
      url = bound.url
      server = bound.server
    } catch {
      return
    }
  }

  async function listen(nextHost: string, nextPort: number): Promise<{ server: Server; url: string; port: number }> {
    if (server) {
      const previous = server
      await closeServer(previous)
      for (const client of clients) client.end()
      clients.clear()
    }
    const next = createServer((request, response) => {
      handleRequest({ request, response, url, bundle, session, clients })
    })
    await new Promise<void>((resolve, reject) => {
      next.once('error', reject)
      next.listen({ host: nextHost, port: nextPort }, () => {
        next.off('error', reject)
        resolve()
      })
    })
    const address = next.address()
    if (!address || typeof address === 'string') throw new Error('Preview server did not bind a TCP port.')
    return { server: next, port: address.port, url: `http://${nextHost}:${address.port}/` }
  }

  async function close(): Promise<void> {
    stopped = true
    watchGeneration += 1
    watcher.close()
    unsubscribe()
    session.close()
    for (const client of clients) client.end()
    clients.clear()
    if (server) await closeServer(server)
  }
}

function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}
