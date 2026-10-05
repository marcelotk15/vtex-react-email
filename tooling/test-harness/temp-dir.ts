import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export async function createTempDir(prefix = 'vtex-harness-'): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix))
}

export async function createTempDirWithSpaces(prefix = 'vtex harness '): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix))
}

export async function removeTempDir(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
  }
  await rm(directory, { recursive: true, force: true }).catch(() => undefined)
}
