import type { IncomingMessage, ServerResponse } from 'node:http'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { PreviewSession } from '../session/session'
import type { SelectionInput } from '../shared/contract'

import { openEventStream } from './event-stream'

export function createPreviewMiddleware(input: {
  session: PreviewSession
  clients: Set<ServerResponse>
  clientRoot: string | null
  serveShell: boolean
}): (request: IncomingMessage, response: ServerResponse, next: () => void) => void {
  return (request, response, next) => {
    const host = request.headers.host ?? '127.0.0.1'
    const location = new URL(request.url ?? '/', `http://${host}`)
    if (request.method === 'GET' && location.pathname === '/api/events') {
      openEventStream(request, response, input.clients, input.session.state())
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
        const nextState = await input.session.select(parsed)
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify(nextState))
      })
      return
    }
    if (input.serveShell && input.clientRoot && request.method === 'GET' && location.pathname === '/') {
      void readFile(path.join(input.clientRoot, 'index.html'), 'utf8').then(
        (html) => {
          response.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          })
          response.end(html)
        },
        () => next(),
      )
      return
    }
    next()
  }
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
