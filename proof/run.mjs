import * as esbuild from 'esbuild'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const outfile = path.join(here, 'out', 'runner.mjs')

await mkdir(path.dirname(outfile), { recursive: true })
await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(here, 'main.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  jsx: 'automatic',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@react-email/components',
    '@react-email/render',
    '@react-email/tailwind',
    'esbuild',
    'handlebars',
    'parse5',
    'zod',
  ],
})

process.env.VTEX_EMAIL_PROOF_DIR = here
await import(pathToFileURL(outfile).href)
