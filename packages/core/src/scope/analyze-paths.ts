import type { z } from 'zod'

import type { ScopeNode } from './structure'

import { errorDiagnostic, warningDiagnostic, type Diagnostic } from '../diagnostics'
import { parsePath } from '../expression/path'
import { asSchema, combineSchemas, isScalarType, peelSchema, schemaDef, type ZodNode } from '../schema/zod-def'

interface Frame {
  schema: ZodNode
  prefix: string[]
}

type Lookup =
  | { status: 'missing' }
  | { status: 'unanalyzable' }
  | { status: 'found'; optional: boolean; schema: ZodNode }

export function analyzePaths(schema: z.ZodType, nodes: readonly ScopeNode[]): Diagnostic[] {
  return walk(nodes, [{ schema: asSchema(schema), prefix: [] }], [])
}

export function analyzeRootPath(schema: z.ZodType, path: string): Diagnostic | null {
  const parsed = parsePath(path, true)
  if (!parsed.ok) return errorDiagnostic('PATH001', parsed.message, { path })
  const lookup = resolve(
    asSchema(schema),
    parsed.segments.filter((segment) => segment !== '..'),
  )
  return missingDiagnostic(path, lookup)
}

function walk(nodes: readonly ScopeNode[], stack: Frame[], guards: readonly string[][]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const node of nodes) {
    if (node.kind === 'ref') {
      diagnostics.push(...inspectRef(node, stack, guards))
      continue
    }
    const absolute = absoluteSegments(node.path, node.parentHops, stack)
    const missing = absolute ? null : contractDiagnostic(node.path, 'missing')
    if (!absolute || missing) {
      if (missing) diagnostics.push(missing)
      continue
    }
    const lookup = lookupAt(stack, node.parentHops, absolute.local)
    const issue = contractDiagnostic(node.path, lookup.status)
    if (issue) {
      diagnostics.push(issue)
      continue
    }
    if (lookup.status !== 'found') continue
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
    if (node.block === 'group') {
      const elements = arrayElements(lookup.schema)
      if (!elements) {
        diagnostics.push(errorDiagnostic('PATH001', `Path "${node.path}" is not an array.`, { path: node.path }))
        continue
      }
      const child: Frame = {
        schema: groupFrameSchema(elements),
        prefix: [...absolute.segments, 'group'],
      }
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
  if (path === '@index') return []
  const absolute = absoluteSegments(path, hops, stack)
  if (!absolute) {
    const missing = contractDiagnostic(path, 'missing')
    return missing ? [missing] : []
  }
  const lookup = lookupAt(stack, hops, absolute.local)
  const issue = contractDiagnostic(path, lookup.status)
  if (issue) return [issue]
  if (lookup.status === 'found' && lookup.optional && !guarded(absolute.segments, guards)) {
    return [warningDiagnostic('PATH002', `Optional path "${path}" is used without a guard.`, { path })]
  }
  return []
}

function missingDiagnostic(path: string, lookup: Lookup): Diagnostic | null {
  return contractDiagnostic(path, lookup.status)
}

function contractDiagnostic(path: string, status: Lookup['status']): Diagnostic | null {
  if (status === 'missing') {
    return errorDiagnostic('PATH001', `Path "${path}" does not exist in the contract.`, { path })
  }
  if (status === 'unanalyzable') {
    return errorDiagnostic('PATH_UNANALYZABLE', `Path "${path}" cannot be analyzed.`, { path })
  }
  return null
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
  const peeled = peelSchema(schema)
  if (peeled.status !== 'ready') return peeled
  if (segments.length === 0) return { status: 'found', optional: peeled.optional, schema: peeled.schema }
  const current = schemaDef(peeled.schema)
  if (current?.type === 'union' && current.options) {
    const results = current.options.map((option) => resolve(option, segments))
    if (results.some((result) => result.status === 'unanalyzable')) return { status: 'unanalyzable' }
    const found = results.filter((result) => result.status === 'found')
    if (found.length === 0) return { status: 'missing' }
    const optional = peeled.optional || found.length !== results.length || found.some((result) => result.optional)
    return { status: 'found', optional, schema: combineSchemas(found.map((result) => result.schema)) }
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
  if (isScalarType(current?.type)) return { status: 'missing' }
  return { status: 'unanalyzable' }
}

function arrayElements(schema: ZodNode): ZodNode | null {
  const peeled = peelSchema(schema)
  if (peeled.status !== 'ready') return null
  const current = schemaDef(peeled.schema)
  if (current?.type === 'array' && current.element) return current.element
  if (current?.type === 'union' && current.options) {
    const elements: ZodNode[] = []
    for (const option of current.options) {
      const element = arrayElements(option)
      if (!element) return null
      elements.push(element)
    }
    return combineSchemas(elements)
  }
  return null
}

function groupFrameSchema(element: ZodNode): ZodNode {
  return {
    def: {
      type: 'object',
      shape: {
        index: { def: { type: 'number' } },
        value: {},
        items: { def: { type: 'array', element } },
      },
    },
  }
}
