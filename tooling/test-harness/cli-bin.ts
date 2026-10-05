import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(here, '../..')
const cliPackageDir = path.join(repoRoot, 'packages', 'cli')
const cliPackageJson = path.join(cliPackageDir, 'package.json')

export async function resolveCliBin(): Promise<string> {
  const parsed = JSON.parse(await readFile(cliPackageJson, 'utf8')) as { bin?: { 'vtex-email'?: string } }
  const relative = parsed.bin?.['vtex-email']
  if (!relative) throw new Error('packages/cli does not declare bin.vtex-email.')
  return path.resolve(cliPackageDir, relative)
}

export async function expectedCliVersion(): Promise<string> {
  const parsed = JSON.parse(await readFile(cliPackageJson, 'utf8')) as { version: string }
  return parsed.version
}
