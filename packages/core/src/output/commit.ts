import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { Diagnostic } from '../diagnostics'

import { normalizeOutput } from '../compile/artifact'
import { validateHandlebarsSyntax } from '../compile/syntax'

export async function releaseArtifacts(input: {
  helperNames: readonly string[]
  directory: string
  files: ReadonlyArray<{ name: string; content: string }>
  remove?: readonly string[]
}): Promise<Diagnostic | null> {
  for (const file of input.files) {
    if (file.name === 'manifest.json') continue
    const issue = validateHandlebarsSyntax(file.content, input.helperNames)
    if (issue) return issue
  }
  await commitArtifacts(input.directory, input.files, input.remove)
  return null
}

export async function commitArtifacts(
  directory: string,
  files: ReadonlyArray<{ name: string; content: string }>,
  remove: readonly string[] = [],
): Promise<void> {
  const prepared = files.map((file) => {
    assertArtifactName(file.name)
    if (file.content.length === 0) throw new Error(`Empty artifact content: ${file.name}`)
    return { name: file.name, content: normalizeOutput(file.content) }
  })
  for (const name of remove) assertArtifactName(name)

  await mkdir(directory, { recursive: true })
  const stagingDir = path.join(directory, `.staging-${process.pid}-${Date.now()}`)
  await mkdir(stagingDir)
  const promoted: Array<{ finalPath: string; backup: string; hadOriginal: boolean }> = []
  const removed: Array<{ finalPath: string; backup: string }> = []

  try {
    const staged = []
    for (const [index, file] of prepared.entries()) {
      const temp = path.join(stagingDir, `${index}.html`)
      await writeFile(temp, file.content, { encoding: 'utf8' })
      staged.push({ temp, finalPath: path.join(directory, file.name), backup: path.join(stagingDir, `${index}.bak`) })
    }

    for (const item of staged) {
      await mkdir(path.dirname(item.finalPath), { recursive: true })
      const hadOriginal = await moveIfExists(item.finalPath, item.backup)
      try {
        await rename(item.temp, item.finalPath)
      } catch (error) {
        if (hadOriginal) await rename(item.backup, item.finalPath)
        throw error
      }
      promoted.push({ finalPath: item.finalPath, backup: item.backup, hadOriginal })
    }

    for (const [index, name] of remove.entries()) {
      const finalPath = path.join(directory, name)
      const backup = path.join(stagingDir, `remove-${index}.bak`)
      if (await moveIfExists(finalPath, backup)) removed.push({ finalPath, backup })
    }
  } catch (error) {
    for (const item of [...removed].reverse()) {
      await rename(item.backup, item.finalPath)
    }
    for (const item of [...promoted].reverse()) {
      await rm(item.finalPath, { force: true })
      if (item.hadOriginal) await rename(item.backup, item.finalPath)
    }
    await rm(stagingDir, { recursive: true, force: true })
    throw error
  }

  await rm(stagingDir, { recursive: true, force: true })
}

function assertArtifactName(name: string): void {
  if (name.length === 0 || name.includes('\\') || name.includes('\0') || path.isAbsolute(name)) {
    throw new Error(`Invalid artifact name: ${name}`)
  }
  const parts = name.split('/')
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..')) {
    throw new Error(`Invalid artifact name: ${name}`)
  }
}

async function moveIfExists(from: string, to: string): Promise<boolean> {
  try {
    await rename(from, to)
    return true
  } catch (error) {
    if (isEnoent(error)) return false
    throw error
  }
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
