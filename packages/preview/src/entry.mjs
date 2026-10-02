import * as esbuild from 'esbuild'
import { createHash } from 'node:crypto'
import { existsSync, rmdirSync, rmSync } from 'node:fs'
import { mkdir, mkdtemp, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const project = createHash('sha256').update(path.resolve(process.cwd())).digest('hex').slice(0, 12)
const root = await mkdtemp(path.join(tmpdir(), `vtex email preview-${project}-${process.pid}-`))
const outfile = path.join(root, '.cache', 'preview.mjs')

await mkdir(path.dirname(outfile))
await symlink(
  dependencyModules(here),
  path.join(root, 'node_modules'),
  process.platform === 'win32' ? 'junction' : 'dir',
)
process.on('exit', () => {
  const link = path.join(root, 'node_modules')
  try {
    rmdirSync(link)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    if (code !== 'ENOENT') return
  }
  rmSync(root, { recursive: true, force: true })
})

await esbuild.build({
  absWorkingDir: path.resolve(here, '../..'),
  entryPoints: [path.join(here, 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  jsx: 'automatic',
  logLevel: 'silent',
  define: {
    __VTEX_EMAIL_UI_ROOT__: JSON.stringify(path.join(here, 'ui')),
  },
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@react-email/components',
    '@react-email/render',
    '@react-email/tailwind',
    '@tailwindcss/node',
    '@tailwindcss/oxide',
    'esbuild',
    'zod',
    'handlebars',
    'parse5',
  ],
})

const compiled = await import(pathToFileURL(outfile).href)
export const previewBundlePath = outfile
export const startDev = compiled.startDev
export const startPreview = compiled.startPreview

function dependencyModules(start) {
  let dir = start
  while (true) {
    const candidate = path.join(dir, 'node_modules')
    if (existsSync(path.join(candidate, 'esbuild'))) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Preview dependencies were not found.')
}
