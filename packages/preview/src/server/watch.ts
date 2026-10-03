import { watch, type FSWatcher } from 'node:fs'
import path from 'node:path'

const IGNORED = new Set(['node_modules', 'dist', '.cache'])

export const DEBOUNCE_MS = 150

export function createDebouncedBatch(
  waitMs: number,
  onBatch: (files: string[]) => void,
): {
  push(file: string): void
  close(): void
} {
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = new Set<string>()
  let closed = false
  return {
    push(file) {
      if (closed) return
      pending.add(path.normalize(file))
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        if (closed || pending.size === 0) return
        const batch = [...pending]
        pending.clear()
        onBatch(batch)
      }, waitMs)
    },
    close() {
      closed = true
      if (timer) clearTimeout(timer)
      timer = undefined
      pending.clear()
    },
  }
}

export function ignoredPath(root: string, file: string, extraIgnored: readonly string[] = []): boolean {
  const relative = path.relative(root, file)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return true
  const parts = relative.split(/[\\/]/)
  if (parts.some((part) => IGNORED.has(part))) return true
  for (const ignored of extraIgnored) {
    const ignoredRelative = path.relative(root, path.resolve(ignored))
    if (ignoredRelative.startsWith('..') || path.isAbsolute(ignoredRelative)) continue
    const normalizedRelative = relative.replaceAll('\\', '/')
    const normalizedIgnored = ignoredRelative.replaceAll('\\', '/')
    if (normalizedRelative === normalizedIgnored || normalizedRelative.startsWith(`${normalizedIgnored}/`)) {
      return true
    }
  }
  return false
}

export function watchProject(configDir: string, waitMs: number, onBatch: (files: string[]) => void): { close(): void } {
  const batch = createDebouncedBatch(waitMs, onBatch)
  const watcher: FSWatcher = watch(configDir, { recursive: true }, (_event, filename) => {
    if (!filename) return
    const file = path.resolve(configDir, filename.toString())
    if (ignoredPath(configDir, file)) return
    batch.push(file)
  })
  return {
    close() {
      batch.close()
      watcher.close()
    },
  }
}
