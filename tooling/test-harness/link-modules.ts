import { mkdir, realpath, symlink } from 'node:fs/promises'
import path from 'node:path'

import { repoRoot } from './cli-bin'

const scoped = [
  ['@vtex-email', 'cli', path.join(repoRoot, 'packages', 'cli')],
  ['@vtex-email', 'core', path.join(repoRoot, 'packages', 'core')],
  ['@vtex-email', 'react', path.join(repoRoot, 'packages', 'react')],
  ['@vtex-email', 'preview', path.join(repoRoot, 'packages', 'preview')],
  ['@vtex-email', 'vtex', path.join(repoRoot, 'packages', 'vtex')],
  ['@react-email', 'components', path.join(repoRoot, 'packages', 'cli', 'node_modules', '@react-email', 'components')],
] as const

const topLevel = [
  ['react', path.join(repoRoot, 'packages', 'cli', 'node_modules', 'react')],
  ['react-dom', path.join(repoRoot, 'packages', 'cli', 'node_modules', 'react-dom')],
  ['zod', path.join(repoRoot, 'packages', 'cli', 'node_modules', 'zod')],
] as const

async function link(target: string, destination: string): Promise<void> {
  const resolved = await realpath(target)
  await mkdir(path.dirname(destination), { recursive: true })
  const type = process.platform === 'win32' ? 'junction' : 'dir'
  await symlink(resolved, destination, type)
}

/** Explicit module resolution for temp projects outside examples/. */
export async function linkWorkspaceModules(projectDir: string): Promise<void> {
  const modules = path.join(projectDir, 'node_modules')
  await mkdir(modules, { recursive: true })

  for (const [name, target] of topLevel) {
    await link(target, path.join(modules, name))
  }

  for (const [scope, name, target] of scoped) {
    await link(target, path.join(modules, scope, name))
  }

  await mkdir(path.join(projectDir), { recursive: true })
}
