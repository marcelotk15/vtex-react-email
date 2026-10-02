import type { IncomingMessage, ServerResponse } from 'node:http'

import type { PreviewBundle } from '../assets/build-assets'
import type { PreviewSession } from '../session/session'
import type { SelectionInput } from '../shared/contract'

import { openEventStream } from './event-stream'

export function handleRequest(input: {
  request: IncomingMessage
  response: ServerResponse
  url: string
  bundle: PreviewBundle
  session: PreviewSession
  clients: Set<ServerResponse>
}): void {
  const { request, response, bundle, session, clients } = input
  const location = new URL(request.url ?? '/', input.url)
  if (request.method === 'GET' && location.pathname === '/') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    })
    response.end(bundle.shell)
    return
  }
  if (request.method === 'GET' && location.pathname.startsWith('/assets/')) {
    const asset = bundle.files.get(location.pathname)
    if (!asset) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }
    response.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store' })
    response.end(asset.body)
    return
  }
  if (request.method === 'GET' && location.pathname === '/api/events') {
    openEventStream(request, response, clients, session.state())
    return
  }
  if (request.method === 'POST' && location.pathname === '/api/selection') {
    void readBody(request).then(async (body) => {
      let parsed: SelectionInput
      try {
        parsed = JSON.parse(body) as SelectionInput
      } catch {
        response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        response.end('{"ok":false}')
        return
      }
      if (parsed.mode !== undefined && parsed.mode !== 'runtime' && parsed.mode !== 'forced') {
        response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        response.end('{"ok":false}')
        return
      }
      const next = await session.select(parsed)
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(next))
    })
    return
  }
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  response.end('Not found')
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 100_000) request.destroy(new Error('Selection body is too large.'))
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}
