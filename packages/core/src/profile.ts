export type Evidence = 'documented' | 'verified' | 'experimental'

export type ArgKind = 'path' | 'literal' | 'expression'

export interface HashArg {
  name: string
  kind: ArgKind
}

export interface EmissionCapability {
  name: string
  form: 'inline' | 'block' | 'path'
  evidence: Evidence
  note: string
  arity?: { min: number; max: number }
  args?: readonly ArgKind[]
  hash?: readonly HashArg[]
  /**
   * Named arguments with author-chosen names (identifiers), each of this kind. Used by helpers such as eval whose
   * hash carries variables. Mutually exclusive with hash.
   */
  freeHash?: ArgKind
  /**
   * How an inline capability is written. 'call' (default) is {{name args}}. 'empty-block' is
   * {{#name args}}{{/name}}, for helpers that the destination only documents in block form and whose output is the
   * helper return value (eval).
   */
  emit?: 'call' | 'empty-block'
  literals?: ReadonlyArray<{ index: number; values: readonly string[] }>
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
  hash: Readonly<Record<string, unknown>>
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

export function syntaxHelperNames(profile: EmissionProfile): string[] {
  return profile.capabilities.filter((capability) => capability.form !== 'path').map((capability) => capability.name)
}

export function findCapability(
  profile: EmissionProfile,
  name: string | undefined,
  form?: EmissionCapability['form'],
): EmissionCapability | undefined {
  if (!name) return undefined
  return profile.capabilities.find((item) => item.name === name && (form === undefined || item.form === form))
}
