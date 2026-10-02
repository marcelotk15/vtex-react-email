import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'

import type { PreviewClient, ClientSnapshot } from './preview-client'

const PreviewContext = createContext<PreviewClient | null>(null)

export function PreviewProvider({ client, children }: { client: PreviewClient; children: ReactNode }) {
  return <PreviewContext.Provider value={client}>{children}</PreviewContext.Provider>
}

export function usePreview(): ClientSnapshot {
  const client = useClient()
  return useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot)
}

export function usePreviewClient(): PreviewClient {
  return useClient()
}

function useClient(): PreviewClient {
  const client = useContext(PreviewContext)
  if (!client) throw new Error('Preview client is missing.')
  return client
}
