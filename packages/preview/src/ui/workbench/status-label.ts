import type { ClientSnapshot } from '../client/preview-client'

export function statusLabel(snapshot: ClientSnapshot): string {
  if (!snapshot.state) {
    switch (snapshot.connection) {
      case 'reconnecting':
        return 'Disconnected'
      default:
        return 'Connecting'
    }
  }
  if (snapshot.connection === 'reconnecting') return 'Disconnected'
  if (snapshot.postError) return 'Update failed'
  switch (snapshot.state.status) {
    case 'compiling':
      return 'Compiling'
    case 'stale':
      return snapshot.state.html ? 'Stale' : 'Failed'
    case 'ready':
      return 'Updated'
  }
}
