import type { PreviewState, SelectionInput } from '../../shared/contract'

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting'

export interface ClientSnapshot {
  state: PreviewState | null
  connection: ConnectionStatus
  pending: { emailId: string; fixtureId: string } | null
  postError: boolean
}

export interface PreviewClient {
  getSnapshot(): ClientSnapshot
  subscribe(listener: () => void): () => void
  connect(): () => void
  select(patch: SelectionInput): void
}

const empty: ClientSnapshot = { state: null, connection: 'connecting', pending: null, postError: false }

export function createPreviewClient(): PreviewClient {
  let snapshot: ClientSnapshot = empty
  let source: EventSource | null = null
  let abort: AbortController | null = null
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    connect,
    select,
  }

  function connect(): () => void {
    const events = new EventSource('/api/events')
    source = events
    publish({ ...snapshot, connection: snapshot.state ? 'reconnecting' : 'connecting', postError: false })
    events.onopen = () => publish({ ...snapshot, connection: navigator.onLine ? 'open' : 'reconnecting' })
    events.onerror = () => {
      if (source !== events) return
      publish({ ...snapshot, connection: 'reconnecting' })
    }
    const onOffline = () => {
      if (source !== events) return
      publish({ ...snapshot, connection: 'reconnecting' })
    }
    const onOnline = () => {
      if (source !== events) return
      publish({ ...snapshot, connection: events.readyState === EventSource.OPEN ? 'open' : 'reconnecting' })
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    events.onmessage = (event) => {
      if (source !== events) return
      let next: PreviewState
      try {
        next = JSON.parse(event.data) as PreviewState
      } catch {
        return
      }
      if (next.formatVersion !== 1) return
      if (snapshot.state && next.generation < snapshot.state.generation) return
      const pending =
        snapshot.pending &&
        (next.selection.emailId !== snapshot.pending.emailId || next.selection.fixtureId !== snapshot.pending.fixtureId)
          ? snapshot.pending
          : null
      publish({ state: next, connection: navigator.onLine ? 'open' : 'reconnecting', pending, postError: false })
    }
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      if (source === events) source = null
      events.close()
      abort?.abort()
    }
  }

  function select(patch: SelectionInput): void {
    const current = snapshot.state?.selection
    if (!current) return
    const mode = patch.mode ?? current.mode
    const nextSelection = {
      emailId: patch.emailId ?? current.emailId,
      fixtureId: patch.fixtureId ?? current.fixtureId,
      mode,
      forcedLocale:
        mode === 'runtime' ? null : patch.forcedLocale !== undefined ? patch.forcedLocale : current.forcedLocale,
    }
    abort?.abort()
    const controller = new AbortController()
    abort = controller
    publish({
      ...snapshot,
      pending: { emailId: nextSelection.emailId, fixtureId: nextSelection.fixtureId },
      postError: false,
    })
    void fetch('/api/selection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(nextSelection),
      signal: controller.signal,
    }).then(
      (response) => {
        if (abort !== controller) return
        if (!response.ok) publish({ ...snapshot, postError: true })
      },
      (error: unknown) => {
        if (abort !== controller) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        publish({ ...snapshot, postError: true })
      },
    )
  }

  function publish(next: ClientSnapshot): void {
    snapshot = next
    for (const listener of listeners) listener()
  }
}
