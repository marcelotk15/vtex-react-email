import type { z } from 'zod'

import type { ScopeNode } from './structure'

import { errorDiagnostic, warningDiagnostic, type Diagnostic } from './diagnostics'
import { parsePath } from './emit'

interface ZodNode {
  def?: {
    type?: string
    shape?: Record<string, ZodNode>
    element?: ZodNode
    options?: readonly ZodNode[]
    innerType?: ZodNode
  }
}

interface Frame {
  schema: ZodNode
  prefix: string[]
}

type Lookup =
  | { status: 'missing' }
  | { status: 'unanalyzable' }
  | { status: 'found'; optional: boolean; schema: ZodNode }

export function analyzePaths(schema: z.ZodType, nodes: readonly ScopeNode[]): Diagnostic[] {
  return walk(nodes, [{ schema: schema as ZodNode, prefix: [] }], [])
}

export function analyzeRootPath(schema: z.ZodType, path: string): Diagnostic | null {
  const parsed = parsePath(path, true)
  if (!parsed.ok) return errorDiagnostic('PATH001', parsed.message, { path })
  const lookup = resolve(
    schema as ZodNode,
    parsed.segments.filter((segment) => segment !== '..'),
  )
  if (lookup.status === 'missing') {
    return errorDiagnostic('PATH001', `Path "${path}" does not exist in the contract.`, { path })
  }
  if (lookup.status === 'unanalyzable') {
    return errorDiagnostic('PATH_UNANALYZABLE', `Path "${path}" cannot be analyzed.`, { path })
  }
  return null
}

function walk(nodes: readonly ScopeNode[], stack: Frame[], guards: readonly string[][]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const node of nodes) {
    if (node.kind === 'ref') {
      diagnostics.push(...inspectRef(node, stack, guards))
      continue
    }
    const absolute = absoluteSegments(node.path, node.parentHops, stack)
    if (!absolute) {
      diagnostics.push(
        errorDiagnostic('PATH001', `Path "${node.path}" does not exist in the contract.`, { path: node.path }),
      )
      continue
    }
    const lookup = lookupAt(stack, node.parentHops, absolute.local)
    if (lookup.status === 'missing') {
      diagnostics.push(
        errorDiagnostic('PATH001', `Path "${node.path}" does not exist in the contract.`, { path: node.path }),
      )
      continue
    }
    if (lookup.status === 'unanalyzable') {
      diagnostics.push(
        errorDiagnostic('PATH_UNANALYZABLE', `Path "${node.path}" cannot be analyzed.`, { path: node.path }),
      )
      continue
    }
    if (node.block === 'each') {
      const elements = arrayElements(lookup.schema)
      if (!elements) {
        diagnostics.push(errorDiagnostic('PATH001', `Path "${node.path}" is not an array.`, { path: node.path }))
        continue
      }
      const child: Frame = { schema: elements, prefix: [...absolute.segments, '[]'] }
      const outer = framesAt(stack, node.parentHops)
      diagnostics.push(...walk(node.children, [...outer, child], guards))
      diagnostics.push(...walk(node.fallback, outer, guards))
      continue
    }
    const nextGuards = [...guards, absolute.segments]
    diagnostics.push(...walk(node.children, stack, nextGuards))
    diagnostics.push(...walk(node.fallback, stack, nextGuards))
  }
  return diagnostics
}

function inspectRef(
  node: Extract<ScopeNode, { kind: 'ref' }>,
  stack: Frame[],
  guards: readonly string[][],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  if (node.path) diagnostics.push(...inspectPath(node.path, node.parentHops, stack, guards))
  for (const arg of node.args ?? []) {
    if (arg.kind === 'path') diagnostics.push(...inspectPath(arg.emitted, arg.parentHops, stack, guards))
  }
  return diagnostics
}

function inspectPath(path: string, hops: number, stack: Frame[], guards: readonly string[][]): Diagnostic[] {
  const absolute = absoluteSegments(path, hops, stack)
  if (!absolute) return [errorDiagnostic('PATH001', `Path "${path}" does not exist in the contract.`, { path })]
  const lookup = lookupAt(stack, hops, absolute.local)
  if (lookup.status === 'missing') {
    return [errorDiagnostic('PATH001', `Path "${path}" does not exist in the contract.`, { path })]
  }
  if (lookup.status === 'unanalyzable') {
    return [errorDiagnostic('PATH_UNANALYZABLE', `Path "${path}" cannot be analyzed.`, { path })]
  }
  if (lookup.optional && !guarded(absolute.segments, guards)) {
    return [warningDiagnostic('PATH002', `Optional path "${path}" is used without a guard.`, { path })]
  }
  return []
}

function guarded(segments: readonly string[], guards: readonly string[][]): boolean {
  return guards.some(
    (guard) =>
      guard.length > 0 && guard.length <= segments.length && guard.every((part, index) => part === segments[index]),
  )
}

function framesAt(stack: readonly Frame[], hops: number): Frame[] {
  const depth = Math.max(0, stack.length - 1 - hops)
  return stack.slice(0, depth + 1)
}

function absoluteSegments(
  path: string,
  hops: number,
  stack: readonly Frame[],
): { segments: string[]; local: string[] } | null {
  const parsed = parsePath(path, true)
  if (!parsed.ok) return null
  const local = parsed.segments.filter((segment) => segment !== '..')
  const base = framesAt(stack, hops).at(-1)?.prefix ?? []
  return { local, segments: [...base, ...local] }
}

function lookupAt(stack: readonly Frame[], hops: number, segments: readonly string[]): Lookup {
  const frame = framesAt(stack, hops).at(-1)
  if (!frame) return { status: 'missing' }
  return resolve(frame.schema, segments)
}

function resolve(schema: ZodNode, segments: readonly string[]): Lookup {
  const peeled = peel(schema)
  if (peeled.status !== 'ready') return peeled
  if (segments.length === 0) return { status: 'found', optional: peeled.optional, schema: peeled.schema }
  const current = peeled.schema.def
  if (current?.type === 'union' && current.options) {
    const results = current.options.map((option) => resolve(option, segments))
    if (results.some((result) => result.status === 'unanalyzable')) return { status: 'unanalyzable' }
    const found = results.filter((result) => result.status === 'found')
    if (found.length === 0) return { status: 'missing' }
    const optional = peeled.optional || found.length !== results.length || found.some((result) => result.optional)
    return { status: 'found', optional, schema: combine(found.map((result) => result.schema)) }
  }
  if (current?.type === 'object' && current.shape) {
    const field = current.shape[segments[0] ?? '']
    if (!field) return { status: 'missing' }
    const next = resolve(field, segments.slice(1))
    if (next.status !== 'found') return next
    return { status: 'found', optional: peeled.optional || next.optional, schema: next.schema }
  }
  if (current?.type === 'array' && current.element) {
    if (!/^[0-9]+$/.test(segments[0] ?? '')) return { status: 'missing' }
    const next = resolve(current.element, segments.slice(1))
    if (next.status !== 'found') return next
    return { status: 'found', optional: peeled.optional || next.optional, schema: next.schema }
  }
  if (isScalar(current?.type)) return { status: 'missing' }
  return { status: 'unanalyzable' }
}

function arrayElements(schema: ZodNode): ZodNode | null {
  const peeled = peel(schema)
  if (peeled.status !== 'ready') return null
  const current = peeled.schema.def
  if (current?.type === 'array' && current.element) return current.element
  if (current?.type === 'union' && current.options) {
    const elements: ZodNode[] = []
    for (const option of current.options) {
      const element = arrayElements(option)
      if (!element) return null
      elements.push(element)
    }
    return combine(elements)
  }
  return null
}

function combine(schemas: readonly ZodNode[]): ZodNode {
  const first = schemas[0]
  if (!first || schemas.length === 1) return first ?? {}
  return { def: { type: 'union', options: schemas } }
}

function peel(schema: ZodNode): { status: 'ready'; schema: ZodNode; optional: boolean } | { status: 'unanalyzable' } {
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

function isScalar(type: string | undefined): boolean {
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
