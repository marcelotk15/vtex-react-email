import * as esbuild from 'esbuild'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

declare const __VTEX_EMAIL_UI_ROOT__: string

const nodeBuiltins = new Set([
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'fs',
  'fs/promises',
  'module',
  'os',
  'path',
  'url',
  'util',
])

export interface PreviewAsset {
  body: Uint8Array
  type: string
}

export interface PreviewBundle {
  shell: string
  files: ReadonlyMap<string, PreviewAsset>
}

export function browserImportViolation(specifier: string): string | null {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) return null
  const blocked =
    specifier.startsWith('node:') ||
    nodeBuiltins.has(specifier) ||
    specifier === '@vtex-email/cli' ||
    specifier.startsWith('@vtex-email/cli/') ||
    specifier === '@vtex-email/core' ||
    specifier.startsWith('@vtex-email/core/') ||
    specifier === '@vtex-email/react' ||
    specifier.startsWith('@vtex-email/react/') ||
    specifier.startsWith('@react-email/') ||
    specifier === 'react-dom/server' ||
    specifier.startsWith('react-dom/server/')
  if (!blocked) return null
  return `The preview interface cannot import ${specifier}.`
}

export function previewUiRoot(): string {
  if (typeof __VTEX_EMAIL_UI_ROOT__ === 'string') return __VTEX_EMAIL_UI_ROOT__
  return fileURLToPath(new URL('./ui', import.meta.url))
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
  <title>vtex-email</title>${stylesheet}
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

function boundaryPlugin(): esbuild.Plugin {
  return {
    name: 'preview-ui-boundary',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const violation = browserImportViolation(args.path)
        if (!violation) return undefined
        return { errors: [{ text: violation }] }
      })
    },
  }
}

function tailwindPlugin(): esbuild.Plugin {
  return {
    name: 'preview-ui-tailwind',
    setup(build) {
      build.onLoad({ filter: /[/\\]styles[/\\]app\.css$/ }, async (args) => {
        const source = await readFile(args.path, 'utf8')
        return { contents: await compileInterfaceCss(source, args.path), loader: 'css' }
      })
    },
  }
}

async function compileInterfaceCss(source: string, from: string): Promise<string> {
  const [{ compile, optimize }, { Scanner }] = await Promise.all([
    import('@tailwindcss/node'),
    import('@tailwindcss/oxide'),
  ])
  const compiled = await compile(source, { base: path.dirname(from), from, onDependency() {} })
  const scanner = new Scanner({ sources: compiled.sources })
  return optimize(compiled.build(scanner.scan()), { minify: true }).code
}
