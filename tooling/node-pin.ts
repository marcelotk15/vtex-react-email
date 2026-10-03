import { readFileSync } from 'node:fs'

export function assertPinnedNode(nvmrcPath: string): void {
  const pinned = readFileSync(nvmrcPath, 'utf8').trim()
  if (process.versions.node !== pinned) {
    throw new Error(`Node ${process.versions.node} is not the pinned Node version (${pinned}).`)
  }
}
