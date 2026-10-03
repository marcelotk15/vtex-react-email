import { z } from 'zod'

const ItemSchema = z.looseObject({
  name: z.string(),
  quantity: z.number().int(),
  sellingPrice: z.number().int(),
  imageUrl: z.string(),
  shippingEstimate: z.string(),
})

export const OrderConfirmedSchema = z.looseObject({
  orders: z.array(
    z.looseObject({
      orderId: z.string(),
      orderUrl: z.string(),
      clientProfileData: z.looseObject({
        firstName: z.string().optional(),
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
      items: z.array(ItemSchema),
    }),
  ),
})
