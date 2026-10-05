export type BlockName =
  | 'each'
  | 'if'
  | 'unless'
  | 'ifCond'
  | 'hasSubStr'
  | 'group'
  | 'eq'
  | 'with'
  | 'math'
  | 'richShippingData'

export type DynamicAttribute = 'href' | 'src' | 'alt' | 'title'

export type SiteArgKind = 'path' | 'literal'

export interface ResolvedPath {
  emitted: string
  parentHops: number
}

export interface SiteArgument {
  kind: SiteArgKind
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
