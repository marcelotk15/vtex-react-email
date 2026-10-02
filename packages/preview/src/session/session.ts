import type { BuiltEmail, CliDiagnostic, PreviewResult, ProjectResult } from '@vtex-email/cli'

import path from 'node:path'

import type { PreviewEmail, PreviewState, SelectionInput } from '../shared/contract'

import { classifyChange, relativeToConfig, type SessionPaths } from './change-plan'

export type {
  PreviewDiagnostic,
  PreviewEmail,
  PreviewFixture,
  PreviewSelection,
  PreviewState,
  SelectionInput,
} from '../shared/contract'

export interface PreviewServices {
  compile(emailIds: readonly string[] | null): Promise<ProjectResult>
  refreshFixtures(email: BuiltEmail): Promise<BuiltEmail>
  evaluate(input: {
    email: BuiltEmail
    fixtureId: string
    mode: 'runtime' | 'forced'
    locale?: string
  }): PreviewResult | Promise<PreviewResult>
}

export interface PreviewSession {
  state(): PreviewState
  open(): Promise<PreviewState>
  select(input: SelectionInput): Promise<PreviewState>
  ingest(files: readonly string[]): Promise<PreviewState>
  updatePaths(paths: Partial<SessionPaths>): void
  subscribe(listener: (state: PreviewState) => void): () => void
  close(): void
}

interface Selection {
  emailId: string
  fixtureId: string
  mode: 'runtime' | 'forced'
  forcedLocale: string | null
}

export function createPreviewSession(input: {
  paths: SessionPaths
  emails: BuiltEmail[]
  diagnostics: ProjectResult['diagnostics']
  ok: boolean
  services: PreviewServices
}): PreviewSession {
  let paths = input.paths
  let emails = input.emails.slice()
  let closed = false
  let generation = 0
  let view = 0
  const listeners = new Set<(state: PreviewState) => void>()
  const selection: Selection = {
    emailId: '',
    fixtureId: '',
    mode: 'runtime',
    forcedLocale: null,
  }
  let state = blank()
  normalize()
  state = snapshot('stale', input.diagnostics)

  return { state: () => state, open, select, ingest, updatePaths, subscribe, close }

  async function open(): Promise<PreviewState> {
    if (!input.ok) return publish(snapshot('stale', state.diagnostics))
    const token = ++generation
    return finish(token, await evaluate())
  }

  async function select(next: SelectionInput): Promise<PreviewState> {
    if (closed) return state
    const round = generation
    const viewToken = ++view
    if (next.emailId) selection.emailId = next.emailId
    if (next.fixtureId) selection.fixtureId = next.fixtureId
    if (next.mode) selection.mode = next.mode
    if (next.forcedLocale !== undefined) selection.forcedLocale = next.forcedLocale
    if (selection.mode === 'runtime') selection.forcedLocale = null
    normalize()
    const result = await evaluate()
    if (closed || viewToken !== view || round !== generation) return state
    return applyEvaluation(result)
  }

  async function ingest(files: readonly string[]): Promise<PreviewState> {
    if (closed) return state
    const plan = classifyChange({ paths, emails, files })
    if (plan.kind === 'none') return state
    const token = ++generation
    publish(snapshot('compiling', state.diagnostics))
    let failed = false
    if (plan.kind === 'full' || plan.compile.length > 0) {
      const ids = plan.kind === 'full' ? null : plan.compile
      const result = await input.services.compile(ids)
      if (token !== generation || closed) return state
      failed = !applyCompile(ids, result)
    }
    if (!failed && plan.kind === 'partial') {
      for (const id of plan.fixtures) {
        const current = emails.find((email) => email.id === id)
        if (!current) continue
        const refreshed = await input.services.refreshFixtures(current)
        if (token !== generation || closed) return state
        emails = emails.map((email) => (email.id === id ? refreshed : email))
      }
    }
    if (token !== generation || closed) return state
    if (failed) return publish(keep('stale', state.diagnostics))
    normalize()
    return finish(token, await evaluate())
  }

  function updatePaths(next: Partial<SessionPaths>): void {
    paths = { ...paths, ...next }
  }

  function subscribe(listener: (next: PreviewState) => void): () => void {
    listeners.add(listener)
    listener(state)
    return () => listeners.delete(listener)
  }

  function close(): void {
    closed = true
    generation += 1
    view += 1
  }

  function finish(token: number, result: PreviewResult): PreviewState {
    if (token !== generation || closed) return state
    return applyEvaluation(result)
  }

  function applyCompile(ids: readonly string[] | null, result: ProjectResult): boolean {
    state = { ...state, diagnostics: result.diagnostics }
    if (!result.ok) return false
    if (ids === null) {
      emails = result.emails.slice()
      return true
    }
    for (const email of result.emails) {
      const index = emails.findIndex((item) => item.id === email.id)
      if (index >= 0) emails[index] = email
      else emails.push(email)
    }
    for (const id of ids) {
      if (result.removedEmailIds?.includes(id)) emails = emails.filter((email) => email.id !== id)
    }
    return true
  }

  async function evaluate(): Promise<PreviewResult> {
    const email = normalize()
    if (!email || selection.fixtureId.length === 0) {
      return {
        ok: false,
        exitCode: 2,
        html: '',
        source: '',
        diagnostics: [{ code: 'CFG001', severity: 'error', message: 'There is no fixture to preview.' }],
        selector: false,
        locale: '',
        payloadLocale: null,
      }
    }
    if (blocksArtifact(email) || blocksFixture(email, selection.fixtureId)) {
      return {
        ok: false,
        exitCode: 1,
        html: '',
        source: '',
        diagnostics: email.diagnostics,
        selector: false,
        locale: '',
        payloadLocale: null,
      }
    }
    const locale = selection.mode === 'forced' ? (selection.forcedLocale ?? email.defaultLocale) : undefined
    return input.services.evaluate({
      email,
      fixtureId: selection.fixtureId,
      mode: selection.mode,
      ...(locale ? { locale } : {}),
    })
  }

  function applyEvaluation(result: PreviewResult): PreviewState {
    const diagnostics = result.diagnostics
    if (!result.ok) return publish(keep('stale', diagnostics, result.payloadLocale, result.selector))
    state = {
      ...snapshot('ready', diagnostics),
      html: result.html,
      source: result.source,
      selector: result.selector,
      selection: selectionView(result.payloadLocale),
    }
    return publish(state)
  }

  function normalize(): BuiltEmail | null {
    const email = emails.find((item) => item.id === selection.emailId) ?? emails[0]
    if (!email) {
      selection.emailId = ''
      selection.fixtureId = ''
      return null
    }
    selection.emailId = email.id
    const fixtures = selectable(email)
    if (!fixtures.some((fixture) => fixture.id === selection.fixtureId)) {
      selection.fixtureId = fixtures[0]?.id ?? ''
    }
    if (selection.mode === 'forced' && !selection.forcedLocale) selection.forcedLocale = email.defaultLocale
    return email
  }

  function snapshot(status: PreviewState['status'], diagnostics: CliDiagnostic[]): PreviewState {
    return {
      formatVersion: 1,
      status,
      generation,
      project: { name: path.basename(paths.configDir) },
      emails: emails
        .map((email) => emailView(email, paths.configDir))
        .sort((left, right) => left.id.localeCompare(right.id)),
      selection: selectionView(state?.selection.payloadLocale ?? null),
      html: state?.html ?? '',
      source: state?.source ?? '',
      selector: state?.selector ?? false,
      data: activeData(),
      diagnostics,
    }
  }

  function keep(
    status: PreviewState['status'],
    diagnostics: CliDiagnostic[],
    payloadLocale = state.selection.payloadLocale,
    selector = state.selector,
  ): PreviewState {
    return {
      ...snapshot(status, diagnostics),
      html: state.html,
      source: state.source,
      selector,
      selection: selectionView(payloadLocale),
    }
  }

  function selectionView(payloadLocale: string | null): PreviewState['selection'] {
    return {
      emailId: selection.emailId,
      fixtureId: selection.fixtureId,
      mode: selection.mode,
      payloadLocale,
      forcedLocale: selection.mode === 'forced' ? selection.forcedLocale : null,
    }
  }

  function publish(next: PreviewState): PreviewState {
    state = next
    if (!closed) {
      for (const listener of listeners) listener(state)
    }
    return state
  }

  function activeData(): unknown {
    const email = emails.find((item) => item.id === selection.emailId)
    if (!email) return null
    const fixture = selectable(email).find((item) => item.id === selection.fixtureId)
    if (!fixture) return null
    return structuredClone(fixture.data)
  }

  function blank(): PreviewState {
    return {
      formatVersion: 1,
      status: 'stale',
      generation: 0,
      project: { name: '' },
      emails: [],
      selection: { emailId: '', fixtureId: '', mode: 'runtime', payloadLocale: null, forcedLocale: null },
      html: '',
      source: '',
      selector: false,
      data: null,
      diagnostics: [],
    }
  }
}

function emailView(email: BuiltEmail, configDir: string): PreviewEmail {
  return {
    id: email.id,
    locales: [...email.locales],
    localePath: email.localePath,
    fixtures: selectable(email).map((fixture) => ({
      id: fixture.id,
      description: fixture.meta.description,
      origin: fixture.meta.origin,
      purpose: fixture.meta.purpose,
      file: relativeToConfig(fixture.file, configDir),
      ...(fixture.meta.expectedLocale ? { expectedLocale: fixture.meta.expectedLocale } : {}),
    })),
  }
}

function selectable(email: BuiltEmail): BuiltEmail['fixtures'] {
  return email.fixtures.filter((fixture) => !fixture.negative)
}

function blocksArtifact(email: BuiltEmail): boolean {
  return email.diagnostics.some((item) => item.severity === 'error' && item.fixtureId === undefined)
}

function blocksFixture(email: BuiltEmail, fixtureId: string): boolean {
  return email.diagnostics.some((item) => item.severity === 'error' && item.fixtureId === fixtureId)
}
