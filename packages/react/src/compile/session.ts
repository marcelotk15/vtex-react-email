import type { TailwindConfig } from '@react-email/components'

import {
  errorDiagnostic,
  mintToken,
  type Diagnostic,
  type EmissionProfile,
  type Marker,
  type SiteRecord,
} from '@vtex-email/core'
import { AsyncLocalStorage } from 'node:async_hooks'

export class CompileAborted extends Error {
  readonly diagnostics: Diagnostic[]

  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics.map((item) => `${item.code} ${item.message}`).join('\n'))
    this.name = 'CompileAborted'
    this.diagnostics = diagnostics
  }
}

export interface Session {
  locale: string
  catalog: Readonly<Record<string, string>>
  profile: EmissionProfile
  tailwind: TailwindConfig
  markers: Map<string, Marker>
  sites: Map<string, SiteRecord>
  diagnostics: Diagnostic[]
  nextIndex: number
  templateId: string
  file?: string
}

const sessionKey = Symbol.for('vtex-email.compile-session')

function sharedStorage(): AsyncLocalStorage<Session> {
  const host = globalThis as typeof globalThis & { [sessionKey]?: AsyncLocalStorage<Session> }
  host[sessionKey] ??= new AsyncLocalStorage<Session>()
  return host[sessionKey]
}

export function createSession(input: Omit<Session, 'markers' | 'sites' | 'diagnostics' | 'nextIndex'>): Session {
  return { ...input, markers: new Map(), sites: new Map(), diagnostics: [], nextIndex: 0 }
}

export function getSession(): Session {
  const session = sharedStorage().getStore()
  if (!session) {
    throw new CompileAborted([errorDiagnostic('DSL002', 'DSL component called outside a compilation.')])
  }
  return session
}

export function runSession<T>(session: Session, run: () => T): T {
  return sharedStorage().run(session, run)
}

export function abort(session: Session, diagnostic: Diagnostic): never {
  session.diagnostics.push(diagnostic)
  throw new CompileAborted(session.diagnostics)
}

export function addMarker(
  session: Session,
  identity: { kind: string; path: string; detail: string },
  marker: Marker,
): string {
  const id = mintToken({
    kind: identity.kind,
    index: session.nextIndex,
    path: identity.path,
    detail: identity.detail,
  })
  session.nextIndex += 1
  if (session.markers.has(id)) {
    abort(
      session,
      errorDiagnostic('TOK001', `Marker collision at ${identity.path}.`, {
        templateId: session.templateId,
        path: identity.path,
      }),
    )
  }
  session.markers.set(id, marker)
  return id
}

export function addSite(session: Session, id: string, site: SiteRecord): void {
  session.sites.set(id, site)
}
