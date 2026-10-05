import { describe, expect, it } from 'vitest'

import { fixtureFileJsonSchema, fixtureFileSchema } from './file'

describe('fixture file schema', () => {
  it('accepts meta and data, defaults expect, and rejects extras', () => {
    const parsed = fixtureFileSchema.parse({
      $schema: './fixture.schema.json',
      meta: {
        description: 'ok',
        origin: 'test',
        event: 'demo',
        purpose: 'preview',
      },
      data: { code: '1' },
    })
    expect(parsed.meta.expect).toBe('valid')
    expect(parsed.data).toEqual({ code: '1' })

    const bad = fixtureFileSchema.safeParse({
      meta: {
        description: 'ok',
        origin: 'test',
        event: 'demo',
        purpose: 'preview',
        extra: true,
      },
      data: {},
    })
    expect(bad.success).toBe(false)
  })

  it('publishes an input JSON Schema with optional expect', () => {
    const schema = fixtureFileJsonSchema()
    expect(schema.type).toBe('object')
    expect(schema.required).toEqual(['meta', 'data'])
    const meta = schema.properties as Record<string, { required?: string[] }>
    expect(meta.meta?.required).toEqual(['description', 'origin', 'event', 'purpose'])
  })
})
