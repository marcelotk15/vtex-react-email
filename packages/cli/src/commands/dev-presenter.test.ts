import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'

import {
  BANNER_ASCII,
  BANNER_COMPACT,
  bannerWidth,
  createDevPresenter,
  supportsColor,
} from './dev-presenter'

describe('dev presenter', () => {
  it('keeps the banner within 80 columns and switches to the compact line when narrow', async () => {
    expect(bannerWidth()).toBeLessThanOrEqual(78)
    for (const line of BANNER_ASCII) expect(line.length).toBeLessThanOrEqual(78)

    const wide = await capture({ columns: 80 })
    await wide.presenter.printBanner()
    expect(wide.stdout()).toContain(BANNER_ASCII[0])
    expect(wide.stdout()).toContain('email React')
    expect(wide.stdout()).toContain('vtex-email 0.0.0')

    const narrow = await capture({ columns: bannerWidth() - 1 })
    await narrow.presenter.printBanner()
    expect(narrow.stdout()).toContain(BANNER_COMPACT)
    expect(narrow.stdout().includes(BANNER_ASCII[0])).toBe(false)
  })

  it('prints the banner once and omits it for JSON', async () => {
    const text = await capture({ columns: 80 })
    await text.presenter.printBanner()
    await text.presenter.printBanner()
    expect(text.stdout().split(BANNER_ASCII[0]!).length - 1).toBe(1)

    const json = await capture({ format: 'json', columns: 80 })
    await json.presenter.printBanner()
    expect(json.stdout()).toBe(`${JSON.stringify({ kind: 'version', version: '0.0.0' })}\n`)
    expect(json.stdout().includes('__')).toBe(false)
  })

  it('disables color for NO_COLOR, CI, and non-TTY streams', () => {
    const tty = { isTTY: true } as NodeJS.WriteStream
    expect(supportsColor(tty, {})).toBe(true)
    expect(supportsColor(tty, { NO_COLOR: '' })).toBe(false)
    expect(supportsColor(tty, { CI: '1' })).toBe(false)
    expect(supportsColor({ isTTY: false } as NodeJS.WriteStream, {})).toBe(false)
  })

  it('colors the banner only when the stream supports color', async () => {
    const colored = await capture({ columns: 80, tty: true, env: {} })
    await colored.presenter.printBanner()
    expect(colored.stdout()).toContain('\u001b[35m')
    expect(colored.stdout()).toContain('\u001b[36m')

    const plain = await capture({ columns: 80, tty: true, env: { NO_COLOR: '1' } })
    await plain.presenter.printBanner()
    expect(plain.stdout().includes('\u001b[')).toBe(false)
  })

  it('omits invented URL, counts, and timing when notices lack them', async () => {
    const { presenter, stdout, stderr } = await capture({ columns: 80 })
    await presenter.printBanner()
    await presenter.handle({ kind: 'phase', phase: 'config' })
    await presenter.handle({ kind: 'project', name: 'demo' })
    expect(stdout()).toContain('starting config')
    expect(stdout()).toContain('project demo')
    expect(stdout().includes('http://')).toBe(false)
    expect(stdout().includes('emails')).toBe(false)
    expect(stdout().includes('ready in')).toBe(false)

    await presenter.handle({
      kind: 'failed',
      exitCode: 1,
      diagnostics: [{ code: 'CFG001', severity: 'error', message: 'Preview port 3000 is already in use on 127.0.0.1.' }],
    })
    expect(stderr()).toContain('CFG001 error Preview port 3000 is already in use on 127.0.0.1.')
    expect(stdout().includes('ready in')).toBe(false)
  })

  it('separates server availability from template readiness', async () => {
    const ready = await capture({ columns: 80 })
    await ready.presenter.handle({ kind: 'listening', url: 'http://127.0.0.1:3000/' })
    await ready.presenter.handle({
      kind: 'startup',
      templatesReady: true,
      elapsedMs: 1234,
      diagnostics: [],
    })
    expect(ready.stdout()).toContain('preview http://127.0.0.1:3000/')
    expect(ready.stdout()).toContain('ready in 1.2s')
    expect(ready.stdout()).toContain('Ctrl+C to stop')

    const degraded = await capture({ columns: 80 })
    await degraded.presenter.handle({ kind: 'listening', url: 'http://127.0.0.1:3001/' })
    await degraded.presenter.handle({
      kind: 'startup',
      templatesReady: false,
      elapsedMs: 500,
      diagnostics: [{ code: 'CFG001', severity: 'error', message: 'broken' }],
    })
    expect(degraded.stdout()).toContain('preview http://127.0.0.1:3001/')
    expect(degraded.stdout().includes('ready in')).toBe(false)
    expect(degraded.stdout()).toContain('server listening · templates have diagnostics')
    expect(degraded.stderr()).toContain('CFG001 error broken')
  })

  it('formats ingest events and recovery without clearing the screen', async () => {
    const { presenter, stdout, stderr } = await capture({ columns: 80 })
    await presenter.handle({
      kind: 'ingest',
      plan: { kind: 'partial', compile: ['order-confirmed'], fixtures: [], schemas: [] },
      failed: true,
      added: [],
      removed: [],
      diagnostics: [{ code: 'CFG001', severity: 'error', message: 'broken' }],
    })
    expect(stdout()).toContain('recompiled order-confirmed')
    expect(stderr()).toContain('compile failed')
    expect(stderr()).toContain('CFG001 error broken')

    await presenter.handle({
      kind: 'ingest',
      plan: { kind: 'partial', compile: [], fixtures: ['order-confirmed'], schemas: [] },
      failed: false,
      added: ['auth-code'],
      removed: [],
      diagnostics: [],
    })
    expect(stdout()).toContain('fixture updated order-confirmed')
    expect(stdout()).toContain('email added auth-code')
    expect(stdout()).toContain('recovered')

    await presenter.handle({ kind: 'stopped' })
    expect(stdout()).toContain('stopped')
  })

  it('emits machine-readable notices without ANSI for JSON', async () => {
    const { presenter, stdout } = await capture({ format: 'json', tty: true, env: {} })
    await presenter.printBanner()
    await presenter.handle({ kind: 'listening', url: 'http://127.0.0.1:3000/' })
    expect(stdout()).toBe(
      [
        JSON.stringify({ kind: 'version', version: '0.0.0' }),
        JSON.stringify({ kind: 'listening', url: 'http://127.0.0.1:3000/' }),
        '',
      ].join('\n'),
    )
    expect(stdout().includes('\u001b[')).toBe(false)
  })
})

async function capture(input: {
  format?: 'text' | 'json'
  columns?: number
  tty?: boolean
  env?: NodeJS.ProcessEnv
}): Promise<{
  presenter: ReturnType<typeof createDevPresenter>
  stdout: () => string
  stderr: () => string
}> {
  const out = mockStream(input.tty === true)
  const err = mockStream(input.tty === true)
  const presenter = createDevPresenter({
    version: '0.0.0',
    format: input.format ?? 'text',
    stdout: out.stream,
    stderr: err.stream,
    env: input.env ?? { NO_COLOR: '1' },
    ...(input.columns !== undefined ? { columns: input.columns } : {}),
  })
  return {
    presenter,
    stdout: () => out.read(),
    stderr: () => err.read(),
  }
}

function mockStream(tty: boolean): { stream: NodeJS.WriteStream; read(): string } {
  const pass = new PassThrough()
  const chunks: Buffer[] = []
  pass.on('data', (chunk: Buffer | string) => {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  })
  const stream = pass as unknown as NodeJS.WriteStream
  Object.defineProperty(stream, 'isTTY', { value: tty })
  Object.defineProperty(stream, 'columns', { value: 80 })
  return {
    stream,
    read() {
      return Buffer.concat(chunks).toString('utf8')
    },
  }
}
