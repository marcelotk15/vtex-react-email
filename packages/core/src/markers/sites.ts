import type { ArgKind } from '../profile'

export type BlockName = 'each' | 'if' | 'unless'

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

export interface SiteRecord {
  kind: 'value' | 'helper' | 'block' | 'attr' | 'literal'
  path?: ResolvedPath
  block?: BlockName
  helper?: string
  args?: readonly SiteArgument[]
  attribute?: DynamicAttribute
}
