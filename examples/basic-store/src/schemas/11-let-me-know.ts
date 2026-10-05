import { z } from 'zod'

export default z.looseObject({
  locale: z.string().nullish(),
  _accountInfo: z.looseObject({
    TradingName: z.string().nullish(),
    HostName: z.string().nullish(),
    Id: z.string().nullish(),
    StoreUrl: z.string().nullish(),
    LogoUrl: z.string().nullish(),
  }),
  clientProfileData: z.looseObject({ firstName: z.string().nullish() }).nullish(),
  name: z.string().nullish(),
  productLink: z.string().nullish(),
})
