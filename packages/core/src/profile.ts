export type Evidence = 'documented' | 'verified' | 'experimental'

export type ArgKind = 'path' | 'literal'

export interface EmissionCapability {
  name: string
  form: 'inline' | 'block' | 'path'
  evidence: Evidence
  note: string
  arity?: { min: number; max: number }
  args?: readonly ArgKind[]
  context?: 'preserve' | 'item'
  elseContext?: 'preserve' | 'outer'
}

export interface EmissionProfile {
  id: string
  allowParentSegments: boolean
  capabilities: readonly EmissionCapability[]
}

export interface InlineHelper {
  name: string
  kind: 'inline'
  evidence: Evidence
  note: string
  apply: (...values: unknown[]) => string
}

export interface BlockOptions {
  fn: (context: unknown) => string
  inverse: (context: unknown) => string
}

export interface BlockHelper {
  name: string
  kind: 'block'
  evidence: Evidence
  note: string
  apply: (context: unknown, values: unknown[], options: BlockOptions) => string
}

export type SimulatorHelper = InlineHelper | BlockHelper

export interface LocalSimulator {
  helpers: readonly SimulatorHelper[]
}

export interface Profile extends EmissionProfile {
  helpers: readonly SimulatorHelper[]
}

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
