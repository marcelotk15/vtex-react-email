#!/usr/bin/env node
import * as esbuild from 'esbuild'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const outfile = path.join(here, '../.cache/cli.mjs')

await mkdir(path.dirname(outfile), { recursive: true })
await esbuild.build({
  absWorkingDir: path.resolve(here, '../..'),
  entryPoints: [path.join(here, 'bin.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  jsx: 'automatic',
  logLevel: 'silent',
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
  external: [
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
  ],
})

await import(pathToFileURL(outfile).href)
