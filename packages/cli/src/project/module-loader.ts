import { errorDiagnostic, type Diagnostic } from '@vtex-email/core'
import * as esbuild from 'esbuild'
import { existsSync, rmSync } from 'node:fs'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

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

let sequence = 0
const pendingCaches = new Set<string>()
const cleanupKey = '__vtexEmailBundleCleanup'

if (!(globalThis as Record<string, unknown>)[cleanupKey]) {
  ;(globalThis as Record<string, unknown>)[cleanupKey] = true
  process.once('exit', () => {
    for (const directory of pendingCaches) {
      try {
        rmSync(path.join(directory, 'node_modules'), { recursive: true, force: true })
      } catch {
        // Junction removal may fail if the target disappeared first.
      }
      try {
        rmSync(directory, { recursive: true, force: true })
      } catch {
        // The imported file may stay locked until the process is gone.
      }
    }
  })
}

export async function importBundled(entry: string): Promise<Record<string, unknown>> {
  const loaded = await bundleEntry(entry, { metafile: false, guardTemplate: false })
  return loaded.module
}

export async function loadEmailEntry(entry: string): Promise<LoadEmailResult> {
  let rejection: 'fixture' | 'preview' | null = null
  try {
    return await bundleEntry(entry, {
      metafile: true,
      guardTemplate: true,
      onReject(kind) {
        rejection = kind
      },
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
}

async function bundleEntry(
  entry: string,
  options: {
    metafile: boolean
    guardTemplate: boolean
    onReject?: (kind: 'fixture' | 'preview') => void
  },
): Promise<{ ok: true; module: Record<string, unknown>; dependencies: string[] }> {
  sequence += 1
  const directory = await mkdtemp(path.join(tmpdir(), `vtex-email-bundle-${process.pid}-`))
  pendingCaches.add(directory)
  const outfile = path.join(directory, `bundle-${process.pid}-${sequence}.mjs`)
  await symlink(
    dependencyModules(entry),
    path.join(directory, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )
  try {
    const built = await esbuild.build({
      absWorkingDir: path.dirname(entry),
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      jsx: 'automatic',
      logLevel: 'silent',
      metafile: options.metafile,
      external,
      plugins: options.guardTemplate ? [rejectTemplateImports(entry, options.onReject)] : [],
    })
    const loaded = (await import(pathToFileURL(outfile).href)) as Record<string, unknown>
    const dependencies = Object.keys(built.metafile?.inputs ?? {}).map((file) =>
      path.resolve(path.dirname(entry), file),
    )
    return { ok: true, module: loaded, dependencies }
  } finally {
    await rm(path.join(directory, 'node_modules'), { recursive: true, force: true }).catch(() => undefined)
    await rm(directory, { recursive: true, force: true }).then(
      () => {
        pendingCaches.delete(directory)
      },
      () => {
        // Windows may keep the imported ESM file locked until the process exits.
      },
    )
  }
}

function dependencyModules(start: string): string {
  let dir = path.resolve(path.dirname(start))
  while (true) {
    const candidate = path.join(dir, 'node_modules')
    if (existsSync(path.join(candidate, 'react'))) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Project dependencies were not found.')
}

function rejectTemplateImports(
  entry: string,
  onReject: ((kind: 'fixture' | 'preview') => void) | undefined,
): esbuild.Plugin {
  return {
    name: 'reject-fixtures',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path === '@vtex-email/preview' || args.path === '@react-email/preview') {
          onReject?.('preview')
          return { errors: [{ text: 'DSL001 preview module imported by the template' }] }
        }
        if (!args.path.startsWith('.') && !path.isAbsolute(args.path)) return null
        const base = args.resolveDir || path.dirname(args.importer || entry)
        const resolved = path.resolve(base, args.path)
        if (resolved.split(/[\\/]/).includes('fixtures')) {
          onReject?.('fixture')
          return { errors: [{ text: 'DSL001 fixture imported by the template' }] }
        }
        return null
      })
    },
  }
}
