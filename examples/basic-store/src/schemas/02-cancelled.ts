import { z } from 'zod'

import { order } from './_orders'

const str = z.string().nullish()

/**
 * Cancelled Message Center envelope: order fields at root (no `orders[]`).
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
  cancellationReason: str,
  cancellationData: z
    .looseObject({
      requestedByUser: z.boolean().nullish(),
      reason: str,
      cancellationDate: str,
    })
    .nullish(),
  subjectItemAttachment: z
    .looseObject({
      item: str,
      totalItems: z.number().nullish(),
    })
    .nullish(),
})
