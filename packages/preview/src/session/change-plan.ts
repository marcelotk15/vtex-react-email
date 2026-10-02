import type { BuiltEmail } from '@vtex-email/cli'

import { existsSync } from 'node:fs'
import path from 'node:path'

export interface SessionPaths {
  configDir: string
  configFile: string
  profilePath: string
  catalogFiles: readonly string[]
  emailRoots: readonly string[]
}

export type ChangePlan =
  | { kind: 'none' }
  | { kind: 'full' }
  | { kind: 'partial'; compile: string[]; fixtures: string[] }

export function samePath(left: string, right: string): boolean {
  const a = path.normalize(left)
  const b = path.normalize(right)
  if (process.platform === 'win32') return a.toLowerCase() === b.toLowerCase()
  return a === b
}

export function inside(directory: string, file: string): boolean {
  const relative = path.relative(directory, file)
  return relative.length === 0 || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function classifyChange(input: {
  paths: SessionPaths
  emails: readonly BuiltEmail[]
  files: readonly string[]
  missing?: (file: string) => boolean
}): ChangePlan {
  const missing = input.missing ?? ((file: string) => !existsSync(file))
  let full = false
  const compile = new Set<string>()
  const fixtures = new Set<string>()
  for (const file of input.files) {
    if (samePath(file, input.paths.configFile) || samePath(file, input.paths.profilePath)) {
      full = true
      continue
    }
    const locale = localeFromCatalog(input.paths.catalogFiles, file)
    if (locale) {
      for (const email of input.emails) {
        if (email.locales.includes(locale)) compile.add(email.id)
      }
      continue
    }
    const fixtureOwner = input.emails.find((email) => isFixtureFile(input.paths.configDir, email, file))
    if (fixtureOwner) {
      fixtures.add(fixtureOwner.id)
      continue
    }
    const entry = input.emails.find((email) => samePath(email.file, file))
    if (entry && missing(file)) {
      full = true
      continue
    }
    const dependents = input.emails.filter(
      (email) => samePath(email.file, file) || email.dependencies.some((dependency) => samePath(dependency, file)),
    )
    if (dependents.length > 0) {
      for (const email of dependents) compile.add(email.id)
      continue
    }
    if (isEmailEntry(input.paths.emailRoots, file)) full = true
  }
  if (full) return { kind: 'full' }
  for (const id of compile) fixtures.delete(id)
  if (compile.size === 0 && fixtures.size === 0) return { kind: 'none' }
  return { kind: 'partial', compile: [...compile], fixtures: [...fixtures] }
}

function localeFromCatalog(catalogFiles: readonly string[], file: string): string | null {
  const match = catalogFiles.find((item) => samePath(item, file))
  if (!match) return null
  return path.basename(match, '.json')
}

function isFixtureFile(configDir: string, email: BuiltEmail, file: string): boolean {
  if (email.fixturesPattern.length === 0) return false
  return inside(fixtureDirectory(configDir, email.fixturesPattern), file)
}

export function fixtureDirectory(configDir: string, pattern: string): string {
  const parts = pattern
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part.length > 0 && !part.includes('*'))
  return path.resolve(configDir, ...parts)
}

function isEmailEntry(roots: readonly string[], file: string): boolean {
  if (!file.endsWith('.email.tsx')) return false
  return roots.some((root) => inside(root, file))
}

export function emailRoot(pattern: string): string {
  const [first] = pattern.replaceAll('\\', '/').split('/')
  if (!first || first.includes('*')) return ''
  return first
}

export function relativeToConfig(file: string, configDir: string): string {
  if (!path.isAbsolute(file)) return file.split(path.sep).join('/')
  const relative = path.relative(configDir, file)
  if (relative.length === 0 || relative.startsWith('..') || path.isAbsolute(relative)) return path.basename(file)
  return relative.split(path.sep).join('/')
}
