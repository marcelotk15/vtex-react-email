import type { ArgKind } from '../profile'

export type BlockName = 'each' | 'if' | 'unless' | 'ifCond' | 'hasSubStr' | 'group' | 'eq'

export type DynamicAttribute = 'href' | 'src' | 'alt' | 'title'

export interface ResolvedPath {
  emitted: string
  parentHops: number
}

export interface SiteArgument {
  kind: ArgKind
  emitted: string
  path?: ResolvedPath
}

export interface SiteHash {
  readonly [name: string]: SiteArgument
}

export interface SiteRecord {
  kind: 'value' | 'helper' | 'block' | 'attr' | 'literal'
  path?: ResolvedPath
  block?: BlockName
  helper?: string
  args?: readonly SiteArgument[]
  hash?: SiteHash
  attribute?: DynamicAttribute
}
