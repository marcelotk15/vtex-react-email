import type { ServerResponse } from 'node:http'
import type { IncomingMessage } from 'node:http'

import type { PreviewState } from '../shared/contract'

export function broadcast(clients: ReadonlySet<ServerResponse>, state: PreviewState): void {
  const payload = `data: ${JSON.stringify(state)}\n\n`
  for (const client of clients) client.write(payload)
}

export function openEventStream(
  request: IncomingMessage,
  response: ServerResponse,
  clients: Set<ServerResponse>,
  state: PreviewState,
): void {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  response.write('\n')
  clients.add(response)
  request.on('close', () => clients.delete(response))
  response.write(`data: ${JSON.stringify(state)}\n\n`)
}
