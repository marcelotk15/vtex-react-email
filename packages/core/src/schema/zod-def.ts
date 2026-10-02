const MUTATING = new Set(['transform', 'default', 'prefault', 'catch', 'pipe'])

export interface ZodNode {
  def?: {
    type?: string
    coerce?: boolean
    shape?: Record<string, ZodNode>
    element?: ZodNode
    options?: readonly ZodNode[]
    innerType?: ZodNode
  }
}

export function asSchema(schema: unknown): ZodNode {
  return schema as ZodNode
}

export function schemaDef(schema: ZodNode): NonNullable<ZodNode['def']> | undefined {
  return schema.def
}

export function combineSchemas(schemas: readonly ZodNode[]): ZodNode {
  const first = schemas[0]
  if (!first || schemas.length === 1) return first ?? {}
  return { def: { type: 'union', options: schemas } }
}

export function peelSchema(
  schema: ZodNode,
): { status: 'ready'; schema: ZodNode; optional: boolean } | { status: 'unanalyzable' } {
  let current = schema
  let optional = false
  const seen = new Set<ZodNode>()
  while (current.def && !seen.has(current)) {
    seen.add(current)
    const type = current.def.type
    if (type === 'optional' || type === 'nullable') {
      optional = true
      if (!current.def.innerType) return { status: 'unanalyzable' }
      current = current.def.innerType
      continue
    }
    return { status: 'ready', schema: current, optional }
  }
  return { status: 'unanalyzable' }
}

export function isScalarType(type: string | undefined): boolean {
  return (
    type === 'string' ||
    type === 'number' ||
    type === 'int' ||
    type === 'boolean' ||
    type === 'bigint' ||
    type === 'literal' ||
    type === 'enum' ||
    type === 'null' ||
    type === 'date' ||
    type === 'any' ||
    type === 'unknown'
  )
}

export function schemaMutates(schema: unknown): boolean {
  const seen = new Set<unknown>()
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object' || seen.has(node)) return false
    seen.add(node)
    const def = (node as ZodNode).def
    if (!def || typeof def !== 'object') return false
    if (def.coerce === true || (typeof def.type === 'string' && MUTATING.has(def.type))) return true
    for (const value of Object.values(def)) {
      if (Array.isArray(value)) {
        if (value.some((item) => visit(item))) return true
        continue
      }
      if (value && typeof value === 'object') {
        if ('def' in value) {
          if (visit(value)) return true
          continue
        }
        if (Object.values(value).some((item) => visit(item))) return true
      }
    }
    return false
  }
  return visit(schema)
}
