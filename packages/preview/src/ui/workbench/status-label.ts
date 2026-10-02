import type { ClientSnapshot } from '../client/preview-client'

export function statusLabel(snapshot: ClientSnapshot): string {
  if (!snapshot.state) return snapshot.connection === 'reconnecting' ? 'Desconectado' : 'Conectando'
  if (snapshot.connection === 'reconnecting') return 'Desconectado'
  if (snapshot.postError) return 'Falha ao atualizar'
  if (snapshot.state.status === 'compiling') return 'Compilando'
  if (snapshot.state.status === 'stale') return snapshot.state.html ? 'Desatualizado' : 'Falha'
  return 'Atualizado'
}
