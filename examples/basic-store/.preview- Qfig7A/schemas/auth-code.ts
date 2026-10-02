import { z } from 'zod'

export const AuthCodeSchema = z.looseObject({
  locale: z.string().optional(),
  code: z.string(),
  expired: z.boolean(),
})
