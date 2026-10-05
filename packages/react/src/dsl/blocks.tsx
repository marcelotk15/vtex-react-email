import type { BlockName, OpenMarker, SiteArgument, SiteHash } from '@vtex-email/core'

import { createElement, type ReactElement, type ReactNode } from 'react'

import { addMarker, addSite, getSession } from '../compile/session'
import { expr, type Expression } from './expr'
import { dslFailure, readArgument, resolvePath } from './resolve'
/** Compiler-owned host for block regions. Authors never see or forward this. */
export const BLOCK_HOST = 'vtx-anchor'

export function stamp(children: ReactNode, token: string): ReactElement {
  return createElement(BLOCK_HOST, { 'data-anchor': token }, children)
}

export function openRegion(
  path: string,
  block: BlockName,
  hasElse: boolean,
  extras: { args?: readonly SiteArgument[]; hash?: SiteHash } = {},
): { openId: string; elseId: string | null } {
  const session = getSession()
  const resolved = resolvePath(path, session)
  const marker: OpenMarker = {
    kind: 'open',
    open: '',
    close: '',
    elseId: null,
  }
  const openId = addMarker(session, { kind: 'open', path: resolved.emitted, detail: block }, marker)
  addSite(session, openId, {
    kind: 'block',
    block,
    path: resolved,
    ...(extras.args ? { args: extras.args } : {}),
    ...(extras.hash ? { hash: extras.hash } : {}),
  })
  if (!hasElse) return { openId, elseId: null }
  const elseId = addMarker(
    session,
    { kind: 'else', path: resolved.emitted, detail: `${block}:else` },
    {
      kind: 'else',
      openId,
    },
  )
  marker.elseId = elseId
  return { openId, elseId }
}

export function blockRegion(
  path: string,
  block: BlockName,
  children: ReactNode,
  fallback: ReactNode | undefined,
  extras: { args?: readonly SiteArgument[]; hash?: SiteHash } = {},
): ReactNode {
  const region = openRegion(path, block, fallback !== undefined, extras)
  const thenNode = stamp(children, region.openId)
  if (!region.elseId || fallback === undefined) return thenNode
  return (
    <>
      {thenNode}
      {stamp(fallback, region.elseId)}
    </>
  )
}

export function Each({ path, children, fallback }: { path: string; children: ReactNode; fallback?: ReactNode }) {
  return blockRegion(path, 'each', children, fallback)
}

export function If({ path, children, fallback }: { path: string; children: ReactNode; fallback?: ReactNode }) {
  return blockRegion(path, 'if', children, fallback)
}

export function Unless({ path, children, fallback }: { path: string; children: ReactNode; fallback?: ReactNode }) {
  return blockRegion(path, 'unless', children, fallback)
}

type ComparisonOperator = '==' | '===' | '!=' | '<' | '<=' | '>' | '>='

function asExpression(
  value: Expression | string | number | boolean | null | undefined,
  session: ReturnType<typeof getSession>,
): Expression {
  if (value === undefined) dslFailure(session, 'HBS002', 'A comparison operand is required.')
  if (typeof value === 'object' && value !== null && 'kind' in value) return value
  return expr.literal(value)
}

export function IfCond({
  path,
  operator,
  value,
  right,
  children,
  fallback,
}: {
  path: string
  operator: ComparisonOperator
  value?: string | number | boolean | null
  right?: Expression | string | number | boolean | null
  children: ReactNode
  fallback?: ReactNode
}) {
  const session = getSession()
  const operand = right !== undefined ? asExpression(right, session) : asExpression(value, session)
  return blockRegion(path, 'ifCond', children, fallback, {
    args: [readArgument(expr.literal(operator), session), readArgument(operand, session)],
  })
}

export function HasSubStr({
  path,
  value,
  search,
  children,
  fallback,
}: {
  path: string
  value?: string
  search?: Expression | string
  children: ReactNode
  fallback?: ReactNode
}) {
  const session = getSession()
  const operand = search !== undefined ? asExpression(search, session) : asExpression(value, session)
  return blockRegion(path, 'hasSubStr', children, fallback, {
    args: [readArgument(operand, session)],
  })
}

export function Eq({
  path,
  value,
  right,
  children,
  fallback,
}: {
  path: string
  value?: string | number | boolean | null
  right?: Expression | string | number | boolean | null
  children: ReactNode
  fallback?: ReactNode
}) {
  const session = getSession()
  const operand = right !== undefined ? asExpression(right, session) : asExpression(value, session)
  return blockRegion(path, 'eq', children, fallback, {
    args: [readArgument(operand, session)],
  })
}

export function Group({
  path,
  by,
  children,
  fallback,
}: {
  path: string
  by: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const session = getSession()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(by)) {
    dslFailure(session, 'HBS002', 'Group by must be an identifier.')
  }
  return blockRegion(path, 'group', children, fallback, {
    hash: { by: readArgument(expr.literal(by), session) },
  })
}

export type { Expression }
