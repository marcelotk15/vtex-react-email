import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export function normalizeOutput(content: string): string {
  const normalized = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  if (normalized.includes('\r')) throw new Error('Output still contains CR.')
  return normalized
}

export async function commitArtifacts(
  directory: string,
  files: ReadonlyArray<{ name: string; content: string }>,
): Promise<void> {
  const prepared = files.map((file) => {
    assertArtifactName(file.name)
    if (file.content.length === 0) throw new Error(`Empty artifact content: ${file.name}`)
    return { name: file.name, content: normalizeOutput(file.content) }
  })

  await mkdir(directory, { recursive: true })
  const stagingDir = path.join(directory, `.staging-${process.pid}-${Date.now()}`)
  await mkdir(stagingDir)
  const promoted: Array<{ finalPath: string; backup: string; hadOriginal: boolean }> = []

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
  } catch (error) {
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
