import { z } from 'zod'

import { order } from './_orders'

const str = z.string().nullish()

/**
 * Payment-approved Message Center envelope: order fields at root (no `orders[]`).
 * Built as a single looseObject so path analysis can walk the schema.
 */
export default z.looseObject({
  ...order.shape,
  locale: str,
  split: z.boolean().nullish(),
  ordersUrl: str,
  _accountInfo: z.looseObject({
    TradingName: str,
    HostName: str,
    Id: str,
    StoreUrl: str,
    LogoUrl: str,
  }),
  subjectItemAttachment: z
    .looseObject({
      item: str,
      totalItems: z.number().nullish(),
    })
    .nullish(),
})
