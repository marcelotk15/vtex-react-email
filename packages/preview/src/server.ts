import {
  buildProject,
  importBundled,
  previewBuiltEmail,
  refreshEmailFixtures,
  validateConfig,
  type ProjectResult,
  type ResolvedConfig,
} from '@vtex-email/cli'
import { createServer, type Server, type ServerResponse } from 'node:http'
import path from 'node:path'

import { emailRoot, samePath, type SessionPaths } from './paths'
import { createPreviewSession, type SelectionInput } from './session'
import { buildPreviewAssets, type PreviewBundle } from './ui-build'
import { DEBOUNCE_MS, watchProject } from './watch'

export interface PreviewEndpoint {
  ok: true
  url: string
  close(): Promise<void>
}

export interface PreviewStartupFailure {
  ok: false
  exitCode: 1 | 2
  diagnostics: ProjectResult['diagnostics']
}

export async function startPreview(input: {
  configPath: string
  warningsAsErrors?: boolean
  host?: string
  port?: number
}): Promise<PreviewEndpoint | PreviewStartupFailure> {
  const configPath = path.resolve(input.configPath)
  const loaded = await readConfig(configPath)
  if (!loaded.ok) return { ok: false, exitCode: 2, diagnostics: loaded.diagnostics }
  const warnings = input.warningsAsErrors === true
  const assetsPromise = buildPreviewAssets().then(
    (bundle) => ({ ok: true as const, bundle }),
    (error: unknown) => ({
      ok: false as const,
      message: error instanceof Error ? error.message : 'Failed to build the preview interface.',
    }),
  )
  const built = await buildProject({
    configPath,
    write: false,
    ...(warnings ? { warningsAsErrors: true } : {}),
  })
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

  const paths = sessionPaths(loaded.config, configPath)
  const session = createPreviewSession({
    paths,
    emails: built.emails,
    diagnostics: built.diagnostics,
    ok: built.ok,
    services: {
      compile: (emailIds) => compileProject(configPath, warnings, emailIds),
      refreshFixtures: (email) => refreshEmailFixtures(email, loaded.config.configDir),
      evaluate: (request) => previewBuiltEmail(request),
    },
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
    const payload = `data: ${JSON.stringify(state)}\n\n`
    for (const client of clients) client.write(payload)
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
    const next = await readConfig(configPath)
    if (!next.ok || stopped || token !== watchGeneration) return
    profilePath = next.config.profilePath
    session.updatePaths(sessionPaths(next.config, configPath))
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
    const next = createServer((request, response) => onRequest(request, response, bundle))
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

  function onRequest(
    request: import('node:http').IncomingMessage,
    response: ServerResponse,
    bundle: PreviewBundle,
  ): void {
    const location = new URL(request.url ?? '/', url)
    if (request.method === 'GET' && location.pathname === '/') {
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      })
      response.end(bundle.shell)
      return
    }
    if (request.method === 'GET' && location.pathname.startsWith('/assets/')) {
      const asset = bundle.files.get(location.pathname)
      if (!asset) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('Not found')
        return
      }
      response.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store' })
      response.end(asset.body)
      return
    }
    if (request.method === 'GET' && location.pathname === '/api/events') {
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      response.write('\n')
      clients.add(response)
      request.on('close', () => clients.delete(response))
      const current = session.state()
      response.write(`data: ${JSON.stringify(current)}\n\n`)
      return
    }
    if (request.method === 'POST' && location.pathname === '/api/selection') {
      void readBody(request).then(async (body) => {
        let parsed: SelectionInput
        try {
          parsed = JSON.parse(body) as SelectionInput
        } catch {
          response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          response.end('{"ok":false}')
          return
        }
        if (parsed.mode !== undefined && parsed.mode !== 'runtime' && parsed.mode !== 'forced') {
          response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          response.end('{"ok":false}')
          return
        }
        const next = await session.select(parsed)
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify(next))
      })
      return
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
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

async function readConfig(
  configPath: string,
): Promise<{ ok: true; config: ResolvedConfig } | { ok: false; diagnostics: ProjectResult['diagnostics'] }> {
  try {
    const loaded = await importBundled(configPath)
    const validated = validateConfig(loaded.default, path.dirname(configPath))
    if (!validated.ok) return validated
    return { ok: true, config: validated.config }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load the config.'
    return { ok: false, diagnostics: [{ code: 'CFG001', severity: 'error', message, source: { file: configPath } }] }
  }
}

function sessionPaths(config: ResolvedConfig, configPath: string): SessionPaths {
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

function readBody(request: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 100_000) request.destroy(new Error('Selection body is too large.'))
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}
