import type { ReactElement } from 'react'

import { emitLiteral } from '@vtex-email/core'

import { addMarker, addSite, getSession } from '../compile/session'
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

export function Helper({ name, args }: { name: string; args: readonly unknown[] }) {
  const session = getSession()
  const rendered = args.map((arg) => readArgument(arg, session))
  const token = addMarker(
    session,
    { kind: 'text', path: name, detail: rendered.map((arg) => arg.emitted).join(' ') },
    {
      kind: 'text',
      replacement: '',
    },
  )
  addSite(session, token, { kind: 'helper', helper: name, args: rendered })
  return <span data-anchor={token}>{'\u200b'}</span>
}
