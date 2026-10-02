import type { BlockName, OpenMarker } from '@vtex-email/core'

import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'

import { addMarker, addSite, getSession } from '../compile/session'
import { dslFailure, resolvePath } from './resolve'

export function stamp(children: ReactNode, token: string): ReactElement {
  const session = getSession()
  let only: ReactElement<{ 'data-anchor'?: string }>
  try {
    const child = Children.only(children)
    if (!isValidElement(child) || child.type === Fragment) throw new Error('not an element')
    only = child as ReactElement<{ 'data-anchor'?: string }>
  } catch (error) {
    if (error instanceof Error && error.name === 'CompileAborted') throw error
    dslFailure(session, 'DSL002', 'Each DSL block requires a single root element.')
  }
  return cloneElement(only, { 'data-anchor': token })
}

export function openRegion(
  path: string,
  block: BlockName,
  hasElse: boolean,
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
  addSite(session, openId, { kind: 'block', block, path: resolved })
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
): ReactNode {
  const region = openRegion(path, block, fallback !== undefined)
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
