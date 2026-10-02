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

let sequence = 0

export async function importBundled(entry: string): Promise<Record<string, unknown>> {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cache')
  await mkdir(directory, { recursive: true })
  sequence += 1
  const outfile = path.join(directory, `mod-${process.pid}-${sequence}.mjs`)
  await esbuild.build({
    absWorkingDir: path.dirname(entry),
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    jsx: 'automatic',
    logLevel: 'silent',
    external,
  })
  return (await import(pathToFileURL(outfile).href)) as Record<string, unknown>
}
