import * as esbuild from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const sharedExternal = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@react-email/components',
  '@react-email/render',
  '@react-email/tailwind',
  'esbuild',
  'zod',
  'handlebars',
  'parse5',
  'vite',
  '@vtex-email/core',
  '@vtex-email/react',
  '@vtex-email/vtex',
  '@vtex-email/cli',
  '@vtex-email/cli/project',
  '@vtex-email/preview',
]

const packages = [
  {
    name: 'core',
    entries: [{ entry: 'src/index.ts', outfile: 'dist/index.js' }],
  },
  {
    name: 'vtex',
    entries: [{ entry: 'src/index.ts', outfile: 'dist/index.js' }],
  },
  {
    name: 'react',
    entries: [{ entry: 'src/index.ts', outfile: 'dist/index.js' }],
  },
  {
    name: 'cli',
    entries: [
      { entry: 'src/index.ts', outfile: 'dist/index.js' },
      { entry: 'src/project.ts', outfile: 'dist/project.js' },
      { entry: 'src/bin.ts', outfile: 'dist/bin.js', shebang: true },
    ],
  },
  {
    name: 'preview',
    entries: [{ entry: 'src/index.ts', outfile: 'dist/index.js' }],
  },
]

for (const pkg of packages) {
  await rm(path.join(root, 'packages', pkg.name, 'dist'), { recursive: true, force: true })
}

for (const pkg of packages) {
  const dir = path.join(root, 'packages', pkg.name)
  for (const item of pkg.entries) {
    const outfile = path.join(dir, item.outfile)
    await mkdir(path.dirname(outfile), { recursive: true })
    await esbuild.build({
      absWorkingDir: dir,
      entryPoints: [path.join(dir, item.entry)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      jsx: 'automatic',
      logLevel: 'info',
      mainFields: ['module', 'main'],
      conditions: ['import', 'module', 'default'],
      external: sharedExternal,
    })
    if (item.shebang) {
      const body = await readFile(outfile, 'utf8')
      const without = body.replace(/^#!.*\r?\n/, '')
      await writeFile(outfile, `#!/usr/bin/env node\n${without}`)
    }
  }
  execFileSync(
    process.execPath,
    [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(dir, 'tsconfig.build.json')],
    {
      cwd: root,
      stdio: 'inherit',
    },
  )
}

const { build } = await import('vite')
await build({
  configFile: path.join(root, 'packages/preview/vite.config.ts'),
})

console.log('Built packages.')
