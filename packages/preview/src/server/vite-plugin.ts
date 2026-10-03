import type { ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

import path from 'node:path'

import type { PreviewSession } from '../session/session'

import { samePath } from '../session/change-plan'
import { createPreviewMiddleware } from './http-routes'
import { createDebouncedBatch, DEBOUNCE_MS, ignoredPath } from './watch'

export interface PreviewVitePluginOptions {
  session: PreviewSession
  clients: Set<ServerResponse>
  configDir: string
  configPath: string
  profilePath: string
  outDir: string
  cacheDir: string
  clientRoot: string | null
  serveCompiledClient: boolean
  onConfigPathsChanged: (files: readonly string[]) => void
}

export function previewVitePlugin(options: PreviewVitePluginOptions): Plugin {
  const batch = createDebouncedBatch(DEBOUNCE_MS, (files) => {
    void options.session.ingest(files)
    if (files.some((file) => samePath(file, options.configPath) || samePath(file, options.profilePath))) {
      options.onConfigPathsChanged(files)
    }
  })

  return {
    name: 'vtex-email-preview',
    configureServer(server) {
      const api = createPreviewMiddleware({
        session: options.session,
        clients: options.clients,
        clientRoot: null,
        serveShell: false,
      })
      server.middlewares.use(api)
      return () => {
        if (options.serveCompiledClient && options.clientRoot) {
          const shell = createPreviewMiddleware({
            session: options.session,
            clients: options.clients,
            clientRoot: options.clientRoot,
            serveShell: true,
          })
          server.middlewares.use(shell)
        }
        attachWatcher(server, options, (file) => batch.push(file))
      }
    },
  }
}

function attachWatcher(server: ViteDevServer, options: PreviewVitePluginOptions, push: (file: string) => void): void {
  const extraIgnored = [options.outDir, options.cacheDir]
  server.watcher.add(options.configDir)
  const onFs = (file: string) => {
    const resolved = path.resolve(file)
    if (ignoredPath(options.configDir, resolved, extraIgnored)) return
    push(resolved)
  }
  server.watcher.on('add', onFs)
  server.watcher.on('change', onFs)
  server.watcher.on('unlink', onFs)
}
