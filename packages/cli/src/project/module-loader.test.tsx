import { Button, render } from '@react-email/components'
import path from 'node:path'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { Host } from '../../../react/load-fixtures/button-host'
import { loadEmailEntry } from './module-loader'

function countOf(haystack: string, needle: string): number {
  let count = 0
  let index = 0
  while (index < haystack.length) {
    const found = haystack.indexOf(needle, index)
    if (found === -1) break
    count += 1
    index = found + needle.length
  }
  return count
}

describe('template loader', () => {
  it('preserves Button identity and rejects an imported fixture', async () => {
    const direct = await render(<Button href="https://example.com">only-child</Button>, { pretty: false })
    const loadedHost = await loadEmailEntry(path.resolve('packages/react/load-fixtures/button-host.tsx'))
    expect(loadedHost.ok).toBe(true)
    if (!loadedHost.ok) return
    const exported = loadedHost.module.Host
    expect(typeof exported).toBe('function')
    const bundled = await render(createElement(exported as typeof Host), { pretty: false })
    expect(countOf(direct, 'only-child')).toBe(1)
    expect(countOf(bundled, 'only-child')).toBe(countOf(direct, 'only-child'))
    expect(countOf(bundled, '<!--[if mso]>')).toBe(countOf(direct, '<!--[if mso]>'))

    const forbidden = await loadEmailEntry(path.resolve('packages/react/load-fixtures/forbidden-import.tsx'))
    expect(forbidden.ok).toBe(false)
    if (forbidden.ok) return
    expect(forbidden.diagnostics[0]?.code).toBe('DSL001')

    const email = await loadEmailEntry(path.resolve('proof/emails/order-confirmed.email.tsx'))
    expect(email.ok).toBe(true)

    const preview = await loadEmailEntry(path.resolve('packages/react/load-fixtures/preview-import.tsx'))
    expect(preview.ok).toBe(false)
    if (preview.ok) return
    expect(preview.diagnostics[0]?.code).toBe('DSL001')

    const broken = await loadEmailEntry(path.resolve('packages/react/load-fixtures/broken.tsx'))
    expect(broken.ok).toBe(false)
    if (broken.ok) return
    expect(broken.diagnostics[0]?.code).not.toBe('DSL001')
  })

  it('lists transitive imports in the dependency graph', async () => {
    const entry = path.resolve('packages/react/load-fixtures/transitive-host.tsx')
    const leaf = path.resolve('packages/react/load-fixtures/leaf.tsx')
    const middle = path.resolve('packages/react/load-fixtures/middle.tsx')
    const loaded = await loadEmailEntry(entry)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const normalized = loaded.dependencies.map((file) => path.normalize(file))
    expect(normalized).toEqual(expect.arrayContaining([path.normalize(entry), path.normalize(middle), path.normalize(leaf)]))
  })

  it('keeps bundle files out of the package cache directory', async () => {
    const directory = path.resolve('packages/cli/src/.cache')
    const before = new Set(await listed(directory))
    const loaded = await loadEmailEntry(path.resolve('packages/react/load-fixtures/button-host.tsx'))
    expect(loaded.ok).toBe(true)
    const created = (await listed(directory)).filter((name) => !before.has(name) && name.startsWith('bundle-'))
    expect(created).toEqual([])
  })
})

async function listed(directory: string): Promise<string[]> {
  try {
    const { readdir } = await import('node:fs/promises')
    return await readdir(directory)
  } catch {
    return []
  }
}
