import type { SiteArgument } from '@vtex-email/core'
import type { ReactElement } from 'react'

import { emitLiteral } from '@vtex-email/core'

import { addMarker, addSite, getSession } from '../compile/session'
import { expr } from './expr'
import { readArgument, resolvePath } from './resolve'

export function Value({ path }: { path: string }) {
  return textValue(path)
}

export function textValue(path: string): ReactElement {
  const session = getSession()
  const resolved = resolvePath(path, session)
  const token = addMarker(
    session,
    { kind: 'text', path: resolved.emitted, detail: 'value' },
    {
      kind: 'text',
      replacement: '',
    },
  )
  addSite(session, token, { kind: 'value', path: resolved })
  return <span data-anchor={token}>{'\u200b'}</span>
}

export function textLiteral(value: string | number | boolean | null): ReactElement {
  const session = getSession()
  const emitted = emitLiteral(value)
  const token = addMarker(
    session,
    { kind: 'text', path: 'literal', detail: emitted },
    {
      kind: 'text',
      replacement: '',
    },
  )
  addSite(session, token, { kind: 'literal', args: [{ kind: 'literal', emitted }] })
  return <span data-anchor={token}>{'\u200b'}</span>
}

export function Helper({
  name,
  args,
  hash,
}: {
  name: string
  args: readonly unknown[]
  hash?: Readonly<Record<string, unknown>>
}) {
  const session = getSession()
  const rendered = args.map((arg) => readArgument(arg, session))
  const named: Record<string, SiteArgument> = {}
  for (const [key, value] of Object.entries(hash ?? {})) named[key] = readArgument(value, session)
  const detail = [
    ...rendered.map((arg) => arg.emitted),
    ...Object.entries(named).map(([key, arg]) => `${key}=${arg.emitted}`),
  ].join(' ')
  const token = addMarker(
    session,
    { kind: 'text', path: name, detail },
    {
      kind: 'text',
      replacement: '',
    },
  )
  addSite(session, token, {
    kind: 'helper',
    helper: name,
    args: rendered,
    ...(Object.keys(named).length > 0 ? { hash: named } : {}),
  })
  return <span data-anchor={token}>{'\u200b'}</span>
}

/**
 * VTEX eval: runs `code` on the destination after replacing each `${name}` with the matching `vars` value, and
 * prints the result. Emits `{{#eval "code" name=path}}{{/eval}}`. The result is not escaped, so it may carry markup.
 */
export function Eval({ code, vars = {} }: { code: string; vars?: Readonly<Record<string, unknown>> }) {
  return Helper({ name: 'eval', args: [expr.literal(code)], hash: vars })
}
