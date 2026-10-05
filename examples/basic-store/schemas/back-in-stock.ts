import { z } from 'zod'

export default z.looseObject({
  locale: z.string().optional(),
  addressee: z.looseObject({
    name: z.string().optional(),
  }),
  productName: z.string(),
  productUrl: z.string().optional(),
})
