import { z } from 'zod'

const str = z.string().nullish()
const num = z.number().nullish()

const address = z.looseObject({
  addressId: str,
  street: str,
  number: str,
  city: str,
  state: str,
  postalCode: str,
  neighborhood: str,
  receiverName: str,
})

const sla = z.looseObject({
  id: str,
  name: str,
  shippingEstimate: str,
  shippingEstimateDate: str,
  deliveryWindow: z.looseObject({ startDateUtc: str, endDateUtc: str }).nullish(),
  availableDeliveryWindows: z.array(z.looseObject({})).nullish(),
  pickupStoreInfo: z
    .looseObject({
      friendlyName: str,
      address: address.nullish(),
      isPickupStore: z.boolean().nullish(),
      additionalInfo: str,
      dockId: str,
    })
    .nullish(),
})

const logisticsItem = z.looseObject({
  itemIndex: num,
  itemId: str,
  selectedSla: str,
  selectedDeliveryChannel: str,
  addressId: str,
  deliveryChannel: str,
  shippingEstimate: str,
  shippingEstimateDate: str,
  deliveryWindow: z.looseObject({ startDateUtc: str, endDateUtc: str }).nullish(),
  slas: z.array(sla).nullish(),
})

const orderItem = z.looseObject({
  id: str,
  name: str,
  imageUrl: str,
  quantity: z.number().int(),
  sellingPrice: num,
  price: num,
  itemIndex: num,
  bundleItems: z.array(z.looseObject({ name: str, imageUrl: str })).nullish(),
})

const order = z.looseObject({
  orderId: z.string(),
  value: num,
  clientProfileData: z.looseObject({ firstName: str, lastName: str }).nullish(),
  clientPreferencesData: z.looseObject({ locale: str }).nullish(),
  sellers: z.array(z.looseObject({ name: str })).nullish(),
  items: z.array(orderItem),
  totals: z.array(z.looseObject({ id: z.string(), value: z.number().int() })).nullish(),
  paymentData: z
    .looseObject({
      transactions: z.array(
        z.looseObject({
          payments: z.array(
            z.looseObject({
              paymentSystemName: z.string(),
              lastDigits: str,
              value: z.number().int(),
              installments: z.number().int(),
              url: str,
            }),
          ),
        }),
      ),
    })
    .nullish(),
  shippingData: z
    .looseObject({
      addressId: str,
      logisticsInfo: z.array(logisticsItem),
      availableAddresses: z.array(address).nullish(),
      selectedAddresses: z.array(address).nullish(),
      pickupPoints: z.array(z.looseObject({})).nullish(),
    })
    .nullish(),
  package: z
    .looseObject({
      courier: str,
      trackingNumber: str,
      courierStatus: z
        .looseObject({
          data: z
            .array(
              z.looseObject({
                lastChange: str,
                description: str,
                city: str,
                state: str,
              }),
            )
            .nullish(),
        })
        .nullish(),
    })
    .nullish(),
  giftRegistryData: z.looseObject({}).nullish(),
})

export default z.looseObject({
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
  orders: z.array(order),
})
