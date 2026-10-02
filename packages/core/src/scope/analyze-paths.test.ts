import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { ScopeBlock, ScopeNode, ScopeRef } from './structure'

import { analyzePaths, analyzeRootPath } from './analyze-paths'

const item = z.object({
  name: z.string(),
  note: z.string().optional(),
})

const schema = z.object({
  seller: z.string(),
  items: z.array(item),
  shipping: z.object({ street: z.string() }).optional(),
  payload: z.union([z.object({ kind: z.literal('a'), onlyA: z.string() }), z.object({ kind: z.literal('b') })]),
  box: z.record(z.string(), z.string()),
})

function ref(path: string, parentHops = 0): ScopeRef {
  return { kind: 'ref', role: 'value', path, parentHops }
}

function each(path: string, children: ScopeNode[], fallback: ScopeNode[] = []): ScopeBlock {
  return { kind: 'block', block: 'each', path, parentHops: 0, children, fallback }
}

function guard(block: 'if' | 'unless', path: string, children: ScopeNode[]): ScopeBlock {
  return { kind: 'block', block, path, parentHops: 0, children, fallback: [] }
}

describe('path analysis', () => {
  it('resolves an item path, a parent path, and an index', () => {
    const diagnostics = analyzePaths(schema, [each('items', [ref('name'), ref('../seller', 1)])])
    expect(diagnostics).toEqual([])
    expect(analyzeRootPath(schema, 'items.0.name')).toBeNull()
  })

  it('reports a missing path and an unguarded optional', () => {
    const missing = analyzePaths(schema, [each('items', [ref('missing')])])
    expect(missing[0]?.code).toBe('PATH001')
    const optional = analyzePaths(schema, [each('items', [ref('note')])])
    expect(optional[0]?.code).toBe('PATH002')
  })

  it('accepts an optional path inside a guard and an outer fallback', () => {
    const guarded = analyzePaths(schema, [guard('if', 'shipping.street', [ref('shipping.street')])])
    expect(guarded).toEqual([])
    const fallback = analyzePaths(schema, [each('items', [ref('name')], [ref('seller')])])
    expect(fallback).toEqual([])
    const wrongFallback = analyzePaths(schema, [each('items', [ref('name')], [ref('name')])])
    expect(wrongFallback[0]?.code).toBe('PATH001')
  })

  it('treats a union alternative as optional and a record descent as unanalyzable', () => {
    const partial = analyzePaths(schema, [ref('payload.onlyA')])
    expect(partial.map((item) => item.code)).toEqual(['PATH002'])
    const absent = analyzePaths(schema, [ref('payload.nope')])
    expect(absent[0]?.code).toBe('PATH001')
    const opaque = analyzePaths(schema, [ref('box.name')])
    expect(opaque[0]?.code).toBe('PATH_UNANALYZABLE')
  })

  it('rejects each over a non-array', () => {
    const diagnostics = analyzePaths(schema, [each('seller', [ref('name')])])
    expect(diagnostics[0]?.code).toBe('PATH001')
  })
})
