import type { DevNotice } from '@vtex-email/cli/project'

import {
  createSeedProject,
  removeTempDir,
  SEED_GREETING_EN,
  SEED_GREETING_PT,
  SEED_WELCOME,
  type SeedProject,
} from '@vtex-email/test-harness'
import { createHash } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { PreviewState } from '../session/session'

import { displayDocument } from '../shared/display-document'
import { startPreview, type PreviewEndpoint } from './start-preview'

describe('preview server', () => {
  it('serves an isolated preview without writing dist and rebinds when the port changes', async () => {
    const seed = await createSeedProject({ spaces: true })
    const initialPort = await freePort()
    const nextPort = await freePort()
    await writeFile(
      seed.configPath,
      (await readFile(seed.configPath, 'utf8')).replace('port: 3000', `port: ${initialPort}`),
    )
    const cliPackage = JSON.parse(await readFile(path.resolve('packages/cli/package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const previewPackage = JSON.parse(await readFile(path.resolve('packages/preview/package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    expect(cliPackage.dependencies?.['@vtex-email/preview']).toBeUndefined()
    expect(previewPackage.dependencies?.['@vtex-email/cli']).toBe('workspace:*')

    let started: PreviewEndpoint | undefined
    try {
      const preview = await startPreview({ configPath: seed.configPath })
      if (!preview.ok) throw new Error(JSON.stringify(preview.diagnostics))
      started = preview
      expect(preview.url.startsWith('http://127.0.0.1:')).toBe(true)
      expect(await missing(path.join(seed.root, 'dist'))).toBe(true)

      const page = await fetch(preview.url)
      const html = await page.text()
      expect(html).toContain('<div id="root">')
      expect(html).toContain('<script type="module"')
      expect(html.includes('Content-Security-Policy')).toBe(false)
      expect(html.includes('allow-scripts')).toBe(false)
      const script = /src="([^"]+\.js)"/.exec(html)
      expect(script?.[1]?.startsWith('/assets/')).toBe(true)
      const asset = await fetch(new URL(script?.[1] ?? '', preview.url))
      expect(asset.ok).toBe(true)
      expect(asset.headers.get('content-type')).toContain('javascript')

      const events = await openEvents(preview.url)
      const ready = await events.next()
      expect(ready.status).toBe('ready')
      expect(ready.html.length).toBeGreaterThan(0)
      viewKeepsArtifact(ready.html, ready.source)
      const welcome = await post(preview.url, {
        emailId: SEED_WELCOME,
        fixtureId: 'full',
        mode: 'runtime',
      })
      const delivery = await events.next()
      expect(welcome.html).toBe(delivery.html)
      expect(delivery.html.includes(SEED_GREETING_EN)).toBe(true)
      const deliverySource = digest(delivery.source)

      const missingLocale = await post(preview.url, { fixtureId: 'missing-locale', mode: 'runtime' })
      expect(missingLocale.html.includes(SEED_GREETING_PT) || missingLocale.html.includes('OlÃ¡')).toBe(true)
      expect(missingLocale.html).not.toBe(delivery.html)
      expect(digest(missingLocale.source)).toBe(deliverySource)

      const fixtureFile = path.join(seed.root, 'src', 'fixtures', 'welcome', 'full.jsonc')
      const fixtureBefore = await readFile(fixtureFile, 'utf8')
      const forced = await post(preview.url, { fixtureId: 'full', mode: 'forced', forcedLocale: 'pt-BR' })
      expect(forced.selection.mode).toBe('forced')
      expect(forced.html.includes(SEED_GREETING_PT) || forced.html.includes('OlÃ¡')).toBe(true)
      expect(forced.html.includes(SEED_GREETING_EN)).toBe(false)
      expect(await readFile(fixtureFile, 'utf8')).toBe(fixtureBefore)
      expect(forced.project.name).toBe(path.basename(seed.root))
      expect(forced.emails.find((item) => item.id === SEED_WELCOME)?.localePath).toBe('client.locale')
      expect(
        forced.emails.find((item) => item.id === SEED_WELCOME)?.fixtures.find((item) => item.id === 'full'),
      ).toMatchObject({
        file: 'src/fixtures/welcome/full.jsonc',
        origin: 'synthetic',
        purpose: 'preview',
      })
      expect(localeOf(forced.data)).toBe('en-US')
      expect(digest(forced.source)).toBe(deliverySource)
      expect(await missing(path.join(seed.root, 'dist'))).toBe(true)

      const changed = fixtureBefore.replace('FREEZE-MARKER', 'PreviewName')
      await writeFile(fixtureFile, changed)
      const updated = await waitForState(events, (state) => state.html.includes('PreviewName'))
      expect(updated.status).toBe('ready')
      expect(digest(updated.source)).toBe(deliverySource)
      viewKeepsArtifact(updated.html, updated.source)
      expect(fixtureBefore.includes('Content-Security-Policy')).toBe(false)
      expect(changed.includes('Content-Security-Policy')).toBe(false)

      await writeFile(
        seed.configPath,
        (await readFile(seed.configPath, 'utf8')).replace(`port: ${initialPort}`, `port: ${nextPort}`),
      )
      await waitForPort(nextPort)
      expect(await reachable(initialPort)).toBe(false)
      events.close()
    } finally {
      await started?.close()
      await removeTempDir(seed.root)
    }
  }, 180_000)

  it('reports a busy port and closes idempotently', async () => {
    const seed = await createSeedProject()
    const port = await freePort()
    await writeFile(seed.configPath, (await readFile(seed.configPath, 'utf8')).replace('port: 3000', `port: ${port}`))
    const blocker = createServer()
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject)
      blocker.listen(port, '127.0.0.1', () => resolve())
    })
    try {
      const notices: DevNotice[] = []
      const failed = await startPreview({
        configPath: seed.configPath,
        host: '127.0.0.1',
        port,
        onNotice: (notice) => {
          notices.push(notice)
        },
      })
      expect(failed.ok).toBe(false)
      if (failed.ok) return
      expect(failed.exitCode).toBe(1)
      expect(failed.diagnostics.some((item) => item.message.includes(String(port)))).toBe(true)
      expect(notices.some((item) => item.kind === 'listening')).toBe(false)
      expect(notices.some((item) => item.kind === 'failed')).toBe(true)
      await expect(
        startPreview({ configPath: seed.configPath, host: '127.0.0.1', port }).then(async (result) => {
          if (result.ok) {
            await result.close()
            await result.close()
          }
          return result.ok
        }),
      ).resolves.toBe(false)
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
      await removeTempDir(seed.root)
    }
  }, 60_000)

  it('emits listening only after bind and never repeats a banner notice', async () => {
    const seed = await createSeedProject()
    await withPort(seed, async () => {
      const notices: DevNotice[] = []
      const preview = await startPreview({
        configPath: seed.configPath,
        onNotice: (notice) => {
          notices.push(notice)
        },
      })
      expect(preview.ok).toBe(true)
      if (!preview.ok) return
      try {
        const kinds = notices.map((item) => item.kind)
        expect(kinds.indexOf('listening')).toBeGreaterThan(kinds.lastIndexOf('phase'))
        const listening = notices.find((item) => item.kind === 'listening')
        expect(listening).toEqual({ kind: 'listening', url: preview.url })
        expect(notices.some((item) => item.kind === 'startup')).toBe(true)
        expect(notices.some((item) => item.kind === 'discovered')).toBe(true)
        expect(JSON.stringify(notices).includes('banner')).toBe(false)
      } finally {
        await preview.close()
      }
    })
  }, 120_000)

  it('ignores a neighboring vite.config.ts and closes twice safely', async () => {
    const seed = await createSeedProject()
    await withPort(seed, async (port) => {
      await writeFile(
        path.join(seed.root, 'vite.config.ts'),
        `export default { server: { port: ${port + 1}, host: '0.0.0.0' } }\n`,
      )
      const preview = await startPreview({ configPath: seed.configPath })
      expect(preview.ok).toBe(true)
      if (!preview.ok) return
      try {
        expect(preview.url).toBe(`http://127.0.0.1:${port}/`)
        await preview.close()
        await preview.close()
        expect(await reachable(port)).toBe(false)
      } finally {
        await preview.close()
      }
    })
  }, 120_000)
})

async function withPort(seed: SeedProject, run: (port: number) => Promise<void>): Promise<void> {
  const port = await freePort()
  await writeFile(seed.configPath, (await readFile(seed.configPath, 'utf8')).replace('port: 3000', `port: ${port}`))
  try {
    await run(port)
  } finally {
    await removeTempDir(seed.root)
  }
}

function viewKeepsArtifact(html: string, source: string): void {
  const blocked = displayDocument(html, true)
  expect(displayDocument(html, false)).toBe(html)
  expect(blocked).not.toBe(html)
  expect(blocked).toContain('<meta http-equiv="Content-Security-Policy" content="img-src \'none\'">')
  expect(html.includes('Content-Security-Policy')).toBe(false)
  expect(source.includes('Content-Security-Policy')).toBe(false)
}

function localeOf(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const client = (data as { client?: unknown }).client
  if (!client || typeof client !== 'object') return undefined
  const locale = (client as { locale?: unknown }).locale
  return typeof locale === 'string' ? locale : undefined
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function post(url: string, body: unknown): Promise<PreviewState> {
  const response = await fetch(new URL('/api/selection', url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Selection failed with ${response.status}`)
  return response.json() as Promise<PreviewState>
}

async function openEvents(url: string): Promise<{ next(): Promise<PreviewState>; close(): void }> {
  const response = await fetch(new URL('/api/events', url))
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The event stream has no body.')
  const decoder = new TextDecoder()
  let buffer = ''
  return {
    async next() {
      const started = Date.now()
      while (!buffer.includes('\n\n')) {
        if (Date.now() - started > 20_000) throw new Error('Timed out waiting for a preview event.')
        const chunk = await reader.read()
        if (chunk.done) throw new Error('The event stream closed.')
        buffer += decoder.decode(chunk.value)
      }
      const split = buffer.indexOf('\n\n')
      const raw = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      const line = raw.split('\n').find((item) => item.startsWith('data: '))
      if (!line) throw new Error(`Missing data event: ${raw}`)
      return JSON.parse(line.slice(6)) as PreviewState
    },
    close() {
      void reader.cancel()
    },
  }
}

async function waitForState(
  events: { next(): Promise<PreviewState> },
  accept: (state: PreviewState) => boolean,
): Promise<PreviewState> {
  const started = Date.now()
  let latest: PreviewState | undefined
  while (Date.now() - started < 20_000) {
    latest = await events.next()
    if (accept(latest) && latest.status === 'ready') return latest
  }
  throw new Error(`Timed out waiting for preview state: ${latest?.status ?? 'none'}`)
}

async function waitForPort(port: number): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < 60_000) {
    if (await reachable(port)) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for port ${port}.`)
}

async function reachable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`)
    return response.ok
  } catch {
    return false
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

async function missing(file: string): Promise<boolean> {
  try {
    await access(file)
    return false
  } catch {
    return true
  }
}
