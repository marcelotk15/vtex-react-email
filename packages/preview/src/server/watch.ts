import { watch, type FSWatcher } from 'node:fs'
import path from 'node:path'

const IGNORED = new Set(['node_modules', 'dist', '.cache'])

export const DEBOUNCE_MS = 150

export function watchProject(configDir: string, waitMs: number, onBatch: (files: string[]) => void): { close(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = new Set<string>()
  let closed = false
  const watcher: FSWatcher = watch(configDir, { recursive: true }, (_event, filename) => {
    if (closed || !filename) return
    const file = path.resolve(configDir, filename.toString())
    if (ignored(configDir, file)) return
    pending.add(path.normalize(file))
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      if (closed || pending.size === 0) return
      const batch = [...pending]
      pending.clear()
      onBatch(batch)
    }, waitMs)
  })
  return {
    close() {
      closed = true
      if (timer) clearTimeout(timer)
      timer = undefined
      pending.clear()
      watcher.close()
    },
  }
}

function ignored(root: string, file: string): boolean {
  const relative = path.relative(root, file)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return true
  return relative.split(/[\\/]/).some((part) => IGNORED.has(part))
}
