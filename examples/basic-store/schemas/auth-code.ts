import { z } from 'zod'

export default z.looseObject({
  locale: z.string().optional(),
  code: z.string(),
  expired: z.boolean(),
})
