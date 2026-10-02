import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { watchProject } from './watch'

describe('preview watch', () => {
  it('debounces a batch and stops after close', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-watch-'))
    const batches: string[][] = []
    const watcher = watchProject(root, 40, (files) => batches.push(files))
    try {
      await writeFile(path.join(root, 'a.txt'), 'a')
      await writeFile(path.join(root, 'b.txt'), 'b')
      await waitFor(() => batches.length === 1)
      const first = batches[0] ?? []
      expect(first.some((file) => file.endsWith('a.txt'))).toBe(true)
      expect(first.some((file) => file.endsWith('b.txt'))).toBe(true)

      await mkdir(path.join(root, 'dist'))
      await writeFile(path.join(root, 'dist', 'old.html'), 'old')
      await writeFile(path.join(root, 'c.txt'), 'c')
      await waitFor(() => batches.length === 2)
      const second = batches[1] ?? []
      expect(second.some((file) => file.endsWith('c.txt'))).toBe(true)
      expect(second.some((file) => file.includes(`${path.sep}dist${path.sep}`))).toBe(false)

      watcher.close()
      await writeFile(path.join(root, 'd.txt'), 'd')
      await delay(80)
      expect(batches).toHaveLength(2)
    } finally {
      watcher.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(ready: () => boolean): Promise<void> {
  const started = Date.now()
  while (!ready()) {
    if (Date.now() - started > 2000) throw new Error('Timed out waiting for the watcher.')
    await delay(20)
  }
}
