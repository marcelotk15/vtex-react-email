import { z } from 'zod'

export default z.looseObject({
  orders: z.array(
    z.looseObject({
      orderId: z.string(),
      clientProfileData: z.looseObject({
        firstName: z.string(),
      }),
      clientPreferencesData: z
        .looseObject({
          locale: z.string().optional(),
        })
        .optional(),
      shippingData: z
        .looseObject({
          address: z
            .looseObject({
              street: z.string(),
            })
            .optional(),
        })
        .optional(),
      items: z.array(
        z.looseObject({
          name: z.string(),
          quantity: z.number().int(),
        }),
      ),
    }),
  ),
})
