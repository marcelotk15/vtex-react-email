import * as esbuild from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { themeBootScript } from '../ui/theme/theme'
import { boundaryPlugin } from './browser-boundary'
import { tailwindPlugin } from './interface-css'

declare const __VTEX_EMAIL_UI_ROOT__: string

export interface PreviewAsset {
  body: Uint8Array
  type: string
}

export interface PreviewBundle {
  shell: string
  files: ReadonlyMap<string, PreviewAsset>
}

export { browserImportViolation } from './browser-boundary'

export function previewUiRoot(): string {
  if (typeof __VTEX_EMAIL_UI_ROOT__ === 'string') return __VTEX_EMAIL_UI_ROOT__
  return fileURLToPath(new URL('../ui', import.meta.url))
}

export async function buildPreviewAssets(entry = path.join(previewUiRoot(), 'main.tsx')): Promise<PreviewBundle> {
  const uiRoot = path.dirname(entry)
  let result: esbuild.BuildResult
  try {
    result = await esbuild.build({
      absWorkingDir: uiRoot,
      entryPoints: [entry],
      bundle: true,
      write: false,
      outdir: 'out',
      entryNames: 'assets/[name]-[hash]',
      assetNames: 'assets/[name]-[hash]',
      publicPath: '/',
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      jsx: 'automatic',
      minify: true,
      sourcemap: 'linked',
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' },
      loader: { '.woff2': 'file', '.woff': 'file' },
      plugins: [tailwindPlugin(), boundaryPlugin()],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build the preview interface.'
    throw new Error(message)
  }

  const files = new Map<string, PreviewAsset>()
  const entryName = path.basename(entry, path.extname(entry))
  let script = ''
  let style = ''
  for (const file of result.outputFiles ?? []) {
    const relative = path.relative(path.join(uiRoot, 'out'), file.path).split(path.sep).join('/')
    const url = `/${relative}`
    files.set(url, { body: file.contents, type: contentType(url) })
    if (url.endsWith('.js') && url.includes(`/${entryName}-`)) script = url
    if (url.endsWith('.css') && url.includes(`/${entryName}-`)) style = url
  }
  if (!script) throw new Error('The preview interface did not produce a script.')
  return {
    shell: shellDocument(script, style),
    files,
  }
}

function shellDocument(script: string, style: string): string {
  const stylesheet = style ? `\n  <link rel="stylesheet" href="${style}">` : ''
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>vtex-email</title>
  <script>${themeBootScript()}</script>${stylesheet}
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${script}"></script>
</body>
</html>
`
}

function contentType(url: string): string {
  if (url.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (url.endsWith('.css')) return 'text/css; charset=utf-8'
  if (url.endsWith('.map')) return 'application/json; charset=utf-8'
  if (url.endsWith('.woff2')) return 'font/woff2'
  if (url.endsWith('.woff')) return 'font/woff'
  return 'application/octet-stream'
}
