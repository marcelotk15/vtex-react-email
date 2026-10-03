import type { Diagnostic } from '@vtex-email/core'

import type { DevNotice } from './dev-notices'
import { reportText, writeStream, type CliReport } from './report'

/** Classic ASCII block for “VTEX”; “email React” sits under it. Max line width is 30. */
export const BANNER_ASCII = [
  '__     ___ _____ _______  __',
  '\\ \\   / / |_   _| ____\\ \\/ /',
  ' \\ \\ / /    | | |  _|  \\  / ',
  '  \\ V /     | | | |___ /  \\ ',
  '   \\_/      |_| |_____/_/\\_\\',
  '            email React',
] as const

export const BANNER_COMPACT = 'VTEX email React'

const BANNER_WIDTH = Math.max(...BANNER_ASCII.map((line) => line.length))

export interface DevPresenterOptions {
  version: string
  format: 'text' | 'json'
  stdout?: NodeJS.WriteStream
  stderr?: NodeJS.WriteStream
  env?: NodeJS.ProcessEnv
  columns?: number | undefined
}

export interface DevPresenter {
  printBanner(): Promise<void>
  handle(notice: DevNotice): Promise<void>
}

export function createDevPresenter(options: DevPresenterOptions): DevPresenter {
  const stdout = options.stdout ?? process.stdout
  const stderr = options.stderr ?? process.stderr
  const env = options.env ?? process.env
  const color = supportsColor(stdout, env)
  const json = options.format === 'json'
  let bannerPrinted = false
  let hadCompileFailure = false

  return { printBanner, handle }

  async function printBanner(): Promise<void> {
    if (bannerPrinted) return
    bannerPrinted = true
    if (json) {
      await handle({ kind: 'version', version: options.version })
      return
    }
    const columns = resolveColumns(options.columns, stdout)
    const art = columns !== undefined && columns < BANNER_WIDTH ? BANNER_COMPACT : BANNER_ASCII.join('\n')
    await writeStream(stdout, `${colorBanner(art, color)}\n\n`)
    await line(stdout, dim(`vtex-email ${options.version}`, color))
  }

  async function handle(notice: DevNotice): Promise<void> {
    if (json) {
      await writeStream(stdout, `${JSON.stringify(notice)}\n`)
      return
    }

    switch (notice.kind) {
      case 'version':
        await line(stdout, dim(`vtex-email ${notice.version}`, color))
        return
      case 'phase':
        await line(stdout, dim(`starting ${notice.phase}`, color))
        return
      case 'project':
        await line(stdout, dim(`project ${notice.name}`, color))
        return
      case 'discovered':
        await line(stdout, dim(`${notice.emails} emails · ${notice.fixtures} fixtures`, color))
        return
      case 'listening':
        await line(stdout, `preview ${notice.url}`)
        return
      case 'startup':
        if (notice.templatesReady) {
          await line(stdout, `ready in ${formatElapsed(notice.elapsedMs)}`)
        } else if (notice.diagnostics.length > 0) {
          await writeStream(stderr, diagnosticsText(notice.diagnostics))
          await line(stdout, dim('server listening · templates have diagnostics', color))
        } else {
          await line(stdout, dim('server listening', color))
        }
        await line(stdout, dim('Ctrl+C to stop', color))
        return
      case 'failed':
        await writeStream(stderr, diagnosticsText(notice.diagnostics))
        return
      case 'ingest':
        await handleIngest(notice)
        return
      case 'vite':
        await line(notice.level === 'error' ? stderr : stdout, notice.message.trimEnd())
        return
      case 'stopped':
        await line(stdout, dim('stopped', color))
    }
  }

  async function handleIngest(notice: Extract<DevNotice, { kind: 'ingest' }>): Promise<void> {
    if (notice.plan.kind === 'full') {
      await line(stdout, 'recompiled')
    } else {
      for (const id of notice.plan.compile) await line(stdout, `recompiled ${id}`)
      for (const id of notice.plan.fixtures) await line(stdout, `fixture updated ${id}`)
      for (const id of notice.plan.schemas) await line(stdout, `schema updated ${id}`)
    }
    for (const id of notice.added) await line(stdout, `email added ${id}`)
    for (const id of notice.removed) await line(stdout, `email removed ${id}`)
    if (notice.failed) {
      hadCompileFailure = true
      await line(stderr, 'compile failed')
      if (notice.diagnostics.length > 0) await writeStream(stderr, diagnosticsText(notice.diagnostics))
      return
    }
    if (hadCompileFailure) {
      hadCompileFailure = false
      await line(stdout, 'recovered')
    }
  }
}

export function supportsColor(stream: NodeJS.WriteStream, env: NodeJS.ProcessEnv = process.env): boolean {
  if (Object.prototype.hasOwnProperty.call(env, 'NO_COLOR')) return false
  if (env.CI) return false
  if (env.FORCE_COLOR === '0') return false
  return stream.isTTY === true
}

export function bannerWidth(): number {
  return BANNER_WIDTH
}

function resolveColumns(override: number | undefined, stdout: NodeJS.WriteStream): number | undefined {
  if (typeof override === 'number') return override
  return typeof stdout.columns === 'number' ? stdout.columns : undefined
}

function colorBanner(art: string, color: boolean): string {
  if (!color) return art
  if (art === BANNER_COMPACT) {
    return `${magenta('VTEX')} ${cyan('email React')}`
  }
  const lines = art.split('\n')
  const body = lines.slice(0, -1).map((line) => magenta(line))
  const caption = lines[lines.length - 1] ?? ''
  const trimmed = caption.trimStart()
  const pad = caption.slice(0, caption.length - trimmed.length)
  return [...body, `${pad}${cyan(trimmed)}`].join('\n')
}

function dim(text: string, color: boolean): string {
  return color ? `\u001b[2m${text}\u001b[0m` : text
}

function magenta(text: string): string {
  return `\u001b[35m${text}\u001b[0m`
}

function cyan(text: string): string {
  return `\u001b[36m${text}\u001b[0m`
}

function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < 1000) return `${Math.round(elapsedMs)}ms`
  return `${(elapsedMs / 1000).toFixed(1)}s`
}

function diagnosticsText(diagnostics: readonly Diagnostic[]): string {
  const report: CliReport = {
    formatVersion: 1,
    command: 'usage',
    ok: false,
    exitCode: 1,
    diagnostics: [...diagnostics],
    manifest: null,
    wrote: [],
    preserved: [],
    unverifiedCapabilities: [],
  }
  return reportText(report)
}

async function line(stream: NodeJS.WriteStream, text: string): Promise<void> {
  await writeStream(stream, `${text}\n`)
}
