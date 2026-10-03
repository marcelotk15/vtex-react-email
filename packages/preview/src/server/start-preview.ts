import type { ServerResponse } from 'node:http'

import type { DevNoticeHandler } from '@vtex-email/cli/project'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger, createServer, type Logger, type ViteDevServer } from 'vite'

import { samePath } from '../session/change-plan'
import { createPreviewSession } from '../session/session'
import { broadcast } from './event-stream'
import {
  compilePreviewProject,
  createProjectServices,
  loadPreviewConfig,
  presentCompiled,
  previewPaths,
} from './project-services'
import { previewVitePlugin } from './vite-plugin'

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
  onNotice?: DevNoticeHandler
}): Promise<PreviewEndpoint | PreviewStartupFailure> {
  const startedAt = performance.now()
  const notify = input.onNotice ?? (() => undefined)
  const configPath = path.resolve(input.configPath)

  notify({ kind: 'phase', phase: 'config' })
  const loaded = await loadPreviewConfig(configPath)
  if (!loaded.ok) {
    notify({ kind: 'failed', exitCode: 2, diagnostics: loaded.diagnostics })
    return { ok: false, exitCode: 2, diagnostics: loaded.diagnostics }
  }
  notify({ kind: 'project', name: path.basename(loaded.config.configDir) })

  const warnings = input.warningsAsErrors === true
  const resolvedClient = resolveClientRoot()
  if (!resolvedClient) {
    const diagnostics = [
      {
        code: 'CFG001' as const,
        severity: 'error' as const,
        message: 'Preview client assets were not found. Run the package build before starting the preview.',
      },
    ]
    notify({ kind: 'failed', exitCode: 1, diagnostics })
    return { ok: false, exitCode: 1, diagnostics }
  }
  const clientRoot: string = resolvedClient

  notify({ kind: 'phase', phase: 'compile' })
  const built = await compilePreviewProject(configPath, warnings)
  if (!built.ok && built.exitCode === 2) {
    notify({ kind: 'failed', exitCode: 2, diagnostics: built.diagnostics })
    return { ok: false, exitCode: 2, diagnostics: built.diagnostics }
  }

  const presented = presentCompiled(built, loaded.config.configDir)
  notify({
    kind: 'discovered',
    emails: presented.emails.length,
    fixtures: presented.emails.reduce((total, email) => total + email.fixtures.length, 0),
  })

  const paths = previewPaths(loaded.config, configPath)
  let resolvedConfig = loaded.config
  const session = createPreviewSession({
    paths,
    emails: presented.emails,
    diagnostics: presented.diagnostics,
    ok: presented.ok,
    services: createProjectServices({
      configPath,
      configDir: loaded.config.configDir,
      warningsAsErrors: warnings,
      getConfig: () => resolvedConfig,
    }),
    onIngest: (notice) => {
      notify({
        kind: 'ingest',
        plan: notice.plan,
        failed: notice.failed,
        added: notice.added,
        removed: notice.removed,
        diagnostics: notice.diagnostics,
      })
    },
  })
  await session.open()

  const hostLocked = input.host !== undefined
  const portLocked = input.port !== undefined
  let host = input.host ?? loaded.config.preview.host
  let port = input.port ?? loaded.config.preview.port
  let profilePath = loaded.config.profilePath
  let server: ViteDevServer | null = null
  let url = ''
  const clients = new Set<ServerResponse>()
  let watchGeneration = 0
  let stopped = false
  const cacheDir = path.join(
    tmpdir(),
    `vtex-email-vite-${createHash('sha256').update(configPath).digest('hex').slice(0, 12)}-${process.pid}`,
  )
  await mkdir(cacheDir, { recursive: true })

  const unsubscribe = session.subscribe((state) => {
    broadcast(clients, state)
  })

  notify({ kind: 'phase', phase: 'server' })
  try {
    const bound = await listen(host, port)
    server = bound.server
    url = bound.url
    port = bound.port
  } catch (error) {
    unsubscribe()
    session.close()
    await rm(cacheDir, { recursive: true, force: true }).catch(() => undefined)
    const message = formatListenError(error, host, port)
    const diagnostics = [{ code: 'CFG001' as const, severity: 'error' as const, message }]
    notify({ kind: 'failed', exitCode: 1, diagnostics })
    return { ok: false, exitCode: 1, diagnostics }
  }

  notify({ kind: 'listening', url })
  const current = session.state()
  const hasErrors = current.diagnostics.some((item) => item.severity === 'error')
  notify({
    kind: 'startup',
    templatesReady: current.status === 'ready' && !hasErrors,
    elapsedMs: performance.now() - startedAt,
    diagnostics: current.diagnostics,
  })

  return {
    ok: true,
    get url() {
      return url
    },
    close,
  }

  async function onConfigFiles(files: readonly string[]): Promise<void> {
    const token = ++watchGeneration
    if (stopped || (hostLocked && portLocked)) return
    if (!files.some((file) => samePath(file, configPath) || samePath(file, profilePath))) return
    const next = await loadPreviewConfig(configPath)
    if (!next.ok || stopped || token !== watchGeneration) return
    resolvedConfig = next.config
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
      notify({ kind: 'listening', url })
    } catch {
      // Keep the previous server when rebind fails.
    }
  }

  async function listen(
    nextHost: string,
    nextPort: number,
  ): Promise<{ server: ViteDevServer; url: string; port: number }> {
    const previous = server
    const next = await createServer({
      configFile: false,
      appType: 'custom',
      root: clientRoot,
      base: '/',
      publicDir: false,
      cacheDir,
      logLevel: 'warn',
      clearScreen: false,
      ...(input.onNotice ? { customLogger: viteNoticeLogger(notify) } : {}),
      server: {
        host: nextHost,
        port: nextPort,
        strictPort: true,
        hmr: false,
        fs: {
          allow: [clientRoot],
        },
      },
      plugins: [
        previewVitePlugin({
          session,
          clients,
          configDir: resolvedConfig.configDir,
          configPath,
          profilePath,
          outDir: path.resolve(resolvedConfig.configDir, resolvedConfig.outDir),
          cacheDir,
          clientRoot,
          serveCompiledClient: true,
          onConfigPathsChanged: (files) => {
            void onConfigFiles(files)
          },
        }),
      ],
    })
    try {
      await next.listen()
    } catch (error) {
      await next.close().catch(() => undefined)
      throw error
    }
    if (previous) {
      for (const client of clients) client.end()
      clients.clear()
      await previous.close().catch(() => undefined)
    }
    const address = next.httpServer?.address()
    if (!address || typeof address === 'string') {
      await next.close().catch(() => undefined)
      throw new Error('Preview server did not bind a TCP port.')
    }
    return { server: next, port: address.port, url: `http://${nextHost}:${address.port}/` }
  }

  async function close(): Promise<void> {
    if (stopped) return
    stopped = true
    watchGeneration += 1
    unsubscribe()
    session.close()
    for (const client of clients) client.end()
    clients.clear()
    if (server) {
      await server.close().catch(() => undefined)
      server = null
    }
    await rm(cacheDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

function viteNoticeLogger(notify: DevNoticeHandler): Logger {
  const base = createLogger('warn', { allowClearScreen: false })
  const seen = new Set<string>()
  return {
    hasWarned: false,
    info() {},
    warn(msg) {
      this.hasWarned = true
      notify({ kind: 'vite', level: 'warn', message: stripVitePrefix(msg) })
    },
    warnOnce(msg) {
      const key = msg
      if (seen.has(key)) return
      seen.add(key)
      this.warn(msg)
    },
    error(msg) {
      notify({ kind: 'vite', level: 'error', message: stripVitePrefix(msg) })
    },
    clearScreen() {},
    hasErrorLogged(error) {
      return base.hasErrorLogged(error)
    },
  }
}

function stripVitePrefix(message: string): string {
  return message.replace(/^\s*(?:\[vite\]\s*)?/i, '').trimEnd()
}

function resolveClientRoot(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [path.join(here, 'client'), path.join(here, '../client'), path.resolve(here, '../../dist/client')]
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'index.html'))) return candidate
  }
  return null
}

function formatListenError(error: unknown, host: string, port: number): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : ''
  if (code === 'EADDRINUSE' || /already in use/i.test(message)) {
    return `Preview port ${port} is already in use on ${host}.`
  }
  return message.length > 0 ? message : 'Failed to open the preview server.'
}
