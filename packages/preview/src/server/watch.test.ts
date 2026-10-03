import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDebouncedBatch, watchProject } from './watch'

describe('createDebouncedBatch', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces pushes within the wait window into one batch', () => {
    vi.useFakeTimers()
    const batches: string[][] = []
    const batch = createDebouncedBatch(40, (files) => batches.push(files))
    batch.push('/tmp/a.txt')
    batch.push('/tmp/b.txt')
    expect(batches).toHaveLength(0)
    vi.advanceTimersByTime(40)
    expect(batches).toEqual([[path.normalize('/tmp/a.txt'), path.normalize('/tmp/b.txt')]])
    batch.close()
  })
})

describe('preview watch', () => {
  it('debounces a batch and stops after close', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-watch-'))
    const batches: string[][] = []
    const watcher = watchProject(root, 40, (files) => batches.push(files))
    try {
      await writeFile(path.join(root, 'a.txt'), 'a')
      await writeFile(path.join(root, 'b.txt'), 'b')
      // macOS FSEvents may deliver a.txt and b.txt in separate debounce windows.
      await waitFor(() => {
        const seen = batches.flat()
        return seen.some((file) => file.endsWith('a.txt')) && seen.some((file) => file.endsWith('b.txt'))
      })

      await mkdir(path.join(root, 'dist'))
      await writeFile(path.join(root, 'dist', 'old.html'), 'old')
      await writeFile(path.join(root, 'c.txt'), 'c')
      // macOS FSEvents can emit a late a/b event as its own batch before c.txt lands.
      await waitFor(() => batches.some((batch) => batch.some((file) => file.endsWith('c.txt'))))
      const withC = batches.find((batch) => batch.some((file) => file.endsWith('c.txt'))) ?? []
      expect(withC.some((file) => file.endsWith('c.txt'))).toBe(true)
      expect(withC.some((file) => file.includes(`${path.sep}dist${path.sep}`))).toBe(false)

      const beforeClose = batches.length
      watcher.close()
      await writeFile(path.join(root, 'd.txt'), 'd')
      await delay(80)
      expect(batches).toHaveLength(beforeClose)
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
