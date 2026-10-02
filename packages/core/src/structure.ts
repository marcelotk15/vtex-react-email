import type { BlockName, DynamicAttribute, SiteRecord } from './profile'
import type { Marker } from './tokens'

export interface ScopeArg {
  kind: 'path' | 'literal'
  emitted: string
  parentHops: number
}

export interface ScopeRef {
  kind: 'ref'
  role: 'value' | 'helper' | 'attr'
  path?: string
  parentHops: number
  helper?: string
  args?: readonly ScopeArg[]
  attribute?: DynamicAttribute
}

export interface ScopeBlock {
  kind: 'block'
  block: BlockName
  path: string
  parentHops: number
  children: ScopeNode[]
  fallback: ScopeNode[]
}

export type ScopeNode = ScopeRef | ScopeBlock

interface AnchorSpan {
  start: number
  end: number
}

export function nestSites(
  sites: ReadonlyMap<string, SiteRecord>,
  markers: ReadonlyMap<string, Marker>,
  anchors: ReadonlyMap<string, AnchorSpan>,
): ScopeNode[] {
  const nodes = new Map<string, ScopeNode>()
  for (const [id, site] of sites) {
    const node = siteNode(site)
    if (node) nodes.set(id, node)
  }

  const containers: Array<{ start: number; end: number; blockId: string; slot: 'children' | 'fallback' }> = []
  for (const [id, site] of sites) {
    if (site.kind !== 'block') continue
    const anchor = anchors.get(id)
    if (!anchor) continue
    containers.push({ start: anchor.start, end: anchor.end, blockId: id, slot: 'children' })
    const marker = markers.get(id)
    if (marker?.kind === 'open' && marker.elseId) {
      const elseAnchor = anchors.get(marker.elseId)
      if (elseAnchor) {
        containers.push({ start: elseAnchor.start, end: elseAnchor.end, blockId: id, slot: 'fallback' })
      }
    }
  }

  const roots: Array<{ start: number; node: ScopeNode }> = []
  const placed: Array<{ start: number; blockId: string; slot: 'children' | 'fallback'; node: ScopeNode }> = []
  for (const [id, node] of nodes) {
    const anchor = anchors.get(id)
    const start = anchor?.start ?? 0
    const parent = anchor ? parentOf(id, anchor, containers) : null
    if (!parent) roots.push({ start, node })
    else placed.push({ start, blockId: parent.blockId, slot: parent.slot, node })
  }

  for (const item of placed.sort((left, right) => left.start - right.start)) {
    const block = nodes.get(item.blockId)
    if (block?.kind === 'block') block[item.slot].push(item.node)
    else roots.push({ start: item.start, node: item.node })
  }

  return roots.sort((left, right) => left.start - right.start).map((item) => item.node)
}

function parentOf(
  id: string,
  anchor: AnchorSpan,
  containers: ReadonlyArray<{ start: number; end: number; blockId: string; slot: 'children' | 'fallback' }>,
): { blockId: string; slot: 'children' | 'fallback' } | null {
  let best: { blockId: string; slot: 'children' | 'fallback'; size: number } | null = null
  for (const container of containers) {
    if (container.blockId === id && container.slot === 'children') continue
    const inside = anchor.start >= container.start && anchor.end <= container.end
    if (!inside) continue
    const size = container.end - container.start
    if (!best || size < best.size) best = { blockId: container.blockId, slot: container.slot, size }
  }
  return best
}

function siteNode(site: SiteRecord): ScopeNode | null {
  if (site.kind === 'block' && site.block && site.path) {
    return {
      kind: 'block',
      block: site.block,
      path: site.path.emitted,
      parentHops: site.path.parentHops,
      children: [],
      fallback: [],
    }
  }
  if (site.kind === 'value' && site.path) {
    return { kind: 'ref', role: 'value', path: site.path.emitted, parentHops: site.path.parentHops }
  }
  if (site.kind === 'literal') {
    return { kind: 'ref', role: 'value', parentHops: 0, args: mapArgs(site) }
  }
  if (site.kind === 'helper') {
    return {
      kind: 'ref',
      role: 'helper',
      parentHops: 0,
      ...(site.helper ? { helper: site.helper } : {}),
      args: mapArgs(site),
    }
  }
  if (site.kind === 'attr') {
    return {
      kind: 'ref',
      role: 'attr',
      parentHops: site.path?.parentHops ?? 0,
      ...(site.path ? { path: site.path.emitted } : {}),
      ...(site.attribute ? { attribute: site.attribute } : {}),
      args: mapArgs(site),
    }
  }
  return null
}

function mapArgs(site: SiteRecord): ScopeArg[] {
  return (site.args ?? []).map((arg) => ({
    kind: arg.kind,
    emitted: arg.emitted,
    parentHops: arg.path?.parentHops ?? 0,
  }))
}
