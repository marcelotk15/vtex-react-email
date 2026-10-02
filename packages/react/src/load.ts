import { errorDiagnostic, type Diagnostic } from '@vtex-email/core'
import * as esbuild from 'esbuild'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@react-email/components',
  '@react-email/render',
  '@react-email/tailwind',
  'esbuild',
]

export type LoadEmailResult =
  | { ok: true; module: Record<string, unknown>; dependencies: string[] }
  | { ok: false; diagnostics: Diagnostic[] }

let loadSequence = 0

export async function loadEmailEntry(entry: string): Promise<LoadEmailResult> {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cache')
  await mkdir(directory, { recursive: true })
  loadSequence += 1
  const outfile = path.join(directory, `entry-${process.pid}-${loadSequence}.mjs`)
  let rejection: 'fixture' | 'preview' | null = null
  let built: esbuild.BuildResult | null = null

  try {
    built = await esbuild.build({
      absWorkingDir: path.dirname(entry),
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      jsx: 'automatic',
      logLevel: 'silent',
      metafile: true,
      external,
      plugins: [
        {
          name: 'reject-fixtures',
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (args.path === '@vtex-email/preview' || args.path === '@react-email/preview') {
                rejection = 'preview'
                return { errors: [{ text: 'DSL001 preview module imported by the template' }] }
              }
              if (!args.path.startsWith('.') && !path.isAbsolute(args.path)) return null
              const base = args.resolveDir || path.dirname(args.importer || entry)
              const resolved = path.resolve(base, args.path)
              if (resolved.split(/[\\/]/).includes('fixtures')) {
                rejection = 'fixture'
                return { errors: [{ text: 'DSL001 fixture imported by the template' }] }
              }
              return null
            })
          },
        },
      ],
    })
  } catch (error) {
    if (rejection) {
      const message =
        rejection === 'preview' ? 'Preview module imported by the template.' : 'Fixture imported by the template.'
      return { ok: false, diagnostics: [errorDiagnostic('DSL001', message, { source: { file: entry } })] }
    }
    const message = error instanceof Error ? error.message : 'Failed to load the template.'
    return { ok: false, diagnostics: [errorDiagnostic('CFG001', message, { source: { file: entry } })] }
  }

  const loaded = (await import(pathToFileURL(outfile).href)) as Record<string, unknown>
  const dependencies = Object.keys(built?.metafile?.inputs ?? {}).map((file) => path.resolve(path.dirname(entry), file))
  return { ok: true, module: loaded, dependencies }
}
