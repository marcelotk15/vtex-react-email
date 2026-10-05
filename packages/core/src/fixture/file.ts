import { z } from 'zod'

export const fixtureMetaSchema = z
  .object({
    description: z.string(),
    origin: z.string(),
    event: z.string(),
    purpose: z.string(),
    expectedLocale: z.string().optional(),
    expect: z.enum(['valid', 'invalid']).default('valid'),
  })
  .strict()

export const fixtureFileSchema = z
  .object({
    $schema: z.string().optional(),
    meta: fixtureMetaSchema,
    data: z.json(),
  })
  .strict()

export type FixtureMeta = z.infer<typeof fixtureMetaSchema>
export type FixtureFile = z.infer<typeof fixtureFileSchema>

export function fixtureFileJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(fixtureFileSchema, { io: 'input' }) as Record<string, unknown>
}
