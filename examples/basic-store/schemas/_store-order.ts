import { z } from 'zod'

const attachmentContent = z.looseObject({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  dateRange: z.string().optional(),
  priceTable: z.string().optional(),
  businessAgreement: z.string().optional(),
  deliveryMethod: z.string().optional(),
})

const attachment = z.looseObject({
  name: z.string(),
  content: attachmentContent.optional(),
})

const item = z.looseObject({
  name: z.string().optional(),
  productName: z.string().optional(),
  imageUrl: z.string().optional(),
  image: z.string().optional(),
  refId: z.string().optional(),
  quantity: z.number().int(),
  sellingPrice: z.number().int(),
  uniqueId: z.string().optional(),
  packageId: z.string().optional(),
  ticketUrl: z.string().optional(),
  additionalInfo: z
    .looseObject({
      categoriesIds: z.string().optional(),
    })
    .optional(),
  attachments: z.array(attachment).optional(),
})

const payment = z.looseObject({
  paymentSystemName: z.string(),
  value: z.number().int(),
  installments: z.number().int(),
  dueDate: z.string().optional(),
})

const total = z.looseObject({
  id: z.string(),
  value: z.number().int(),
})

export const orderFields = {
  orderId: z.string(),
  value: z.number().int().optional(),
  clientProfileData: z.looseObject({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
  clientPreferencesData: z
    .looseObject({
      locale: z.string().optional(),
    })
    .optional(),
  paymentData: z
    .looseObject({
      transactions: z.array(
        z.looseObject({
          payments: z.array(payment),
        }),
      ),
    })
    .optional(),
  items: z.array(item),
  totals: z.array(total).optional(),
}

export const orderSchema = z.looseObject(orderFields)

export const ordersSchema = z.looseObject({
  orders: z.array(orderSchema),
})
