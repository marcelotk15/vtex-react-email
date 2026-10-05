import { Img, Section, Text } from '@react-email/components'
import { expr, Trans, Vtex } from '@vtex-email/react'

import { DiscountRows, ParticipantRows } from './attachments'

function ItemImage({ srcPath, altPath }: { srcPath: string; altPath: string }) {
  return <Vtex.Img alt={expr.path(altPath)} height={60} src={expr.path(srcPath)} width={60} />
}

export function OrderItemRows() {
  return (
    <Vtex.Each path="items">
      <Section className="mb-3 rounded-lg border border-zinc-200 p-4">
        <Section>
          <ItemImage altPath="name" srcPath="imageUrl" />
          <Section className="pt-3">
            <Text className="m-0 text-sm font-semibold text-zinc-900">
              <Vtex.Value path="name" />
            </Text>
            <Text className="m-0 mt-2 text-sm text-zinc-600">
              <Trans id="store.item.code" /> <Vtex.Value path="refId" />
            </Text>
            <ParticipantRows />
            <Text className="m-0 mt-2 text-sm text-zinc-600">
              <Trans id="store.item.buyer" /> <Vtex.Value path="../../clientProfileData.firstName" />{' '}
              <Vtex.Value path="../../clientProfileData.lastName" />
            </Text>
            <DiscountRows />
            <Text className="m-0 mt-3 text-sm text-zinc-900">
              x<Vtex.Value path="quantity" /> · <Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />{' '}
              $
            </Text>
          </Section>
        </Section>
      </Section>
    </Vtex.Each>
  )
}

export function OrderItemRowsWithTicket() {
  return (
    <Vtex.Each path="items">
      <Section className="mb-3 rounded-lg border border-zinc-200 p-4">
        <Section>
          <ItemImage altPath="name" srcPath="imageUrl" />
          <Section className="pt-3">
            <Text className="m-0 text-sm font-semibold text-zinc-900">
              <Vtex.Value path="name" />
            </Text>
            <Text className="m-0 mt-2 text-sm text-zinc-600">
              <Trans id="store.item.code" /> <Vtex.Value path="refId" />
            </Text>
            <ParticipantRows />
            <Text className="m-0 mt-2 text-sm text-zinc-600">
              <Trans id="store.item.buyer" /> <Vtex.Value path="../../clientProfileData.firstName" />{' '}
              <Vtex.Value path="../../clientProfileData.lastName" />
            </Text>
            <DiscountRows />
            <Text className="m-0 mt-3 text-sm text-zinc-900">
              x<Vtex.Value path="quantity" /> · <Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />{' '}
              $
            </Text>
            <Vtex.HasSubStr path="additionalInfo.categoriesIds" value="/9293/">
              <Section className="mt-3">
                <Vtex.Button
                  className="rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white no-underline"
                  href="https://example.com/tickets"
                >
                  <Trans id="store.item.downloadTicket" />
                </Vtex.Button>
                <Text className="m-0 mt-2 text-xs text-zinc-500">
                  <Trans id="store.item.ticketMeta" /> #<Vtex.Value path="../../orderId" /> ·{' '}
                  <Vtex.Value path="uniqueId" /> · #<Vtex.Value path="@index" />
                </Text>
              </Section>
            </Vtex.HasSubStr>
          </Section>
        </Section>
      </Section>
    </Vtex.Each>
  )
}

export function SimpleItemRows() {
  return (
    <Vtex.Each path="items">
      <Section className="mb-3 rounded-lg border border-zinc-200 p-4">
        <Text className="m-0 text-sm font-semibold text-zinc-900">
          <Vtex.Value path="name" />
        </Text>
        <Vtex.Each path="attachments">
          <Section>
            <Vtex.IfCond operator="===" path="name" value="DeliveryMethod">
              <Text className="m-0 mt-2 text-sm text-zinc-600">
                <Trans id="store.item.delivery" /> <Vtex.Value path="content.deliveryMethod" />
              </Text>
            </Vtex.IfCond>
          </Section>
        </Vtex.Each>
        <Text className="m-0 mt-3 text-sm text-zinc-900">
          x<Vtex.Value path="quantity" /> · <Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" /> $
        </Text>
      </Section>
    </Vtex.Each>
  )
}

export function CartItemRows() {
  return (
    <Vtex.Each path="items">
      <Section className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <Text className="m-0 text-sm font-semibold text-zinc-900">
          <Vtex.Value path="productName" />
        </Text>
        <Text className="m-0 mt-3 text-sm text-zinc-900">
          x<Vtex.Value path="quantity" /> · $ <Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />
        </Text>
      </Section>
    </Vtex.Each>
  )
}

export function TicketItemRows() {
  return (
    <Vtex.Each path="items">
      <Section className="mb-3 rounded-lg border border-zinc-200 p-4">
        <Img alt="" height={60} src="https://example.com/product.png" width={60} />
        <Text className="m-0 mt-2 text-sm font-semibold text-zinc-900">
          <Vtex.Value path="name" />
        </Text>
        <Text className="m-0 mt-2 text-sm text-zinc-900">
          x<Vtex.Value path="quantity" /> · <Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" /> $
        </Text>
        <Section className="mt-3">
          <Vtex.Button
            className="rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white no-underline"
            href="https://example.com/tickets"
          >
            <Trans id="store.item.openTicket" />
          </Vtex.Button>
        </Section>
      </Section>
    </Vtex.Each>
  )
}

type ItemGroupKind = 'order' | 'simple' | 'cart' | 'ticket' | 'order-ticket'

function groupBody(kind: ItemGroupKind) {
  if (kind === 'order') return <OrderItemRows />
  if (kind === 'order-ticket') return <OrderItemRowsWithTicket />
  if (kind === 'simple') return <SimpleItemRows />
  if (kind === 'cart') return <CartItemRows />
  return <TicketItemRows />
}

export function ItemGroup({ kind }: { kind: ItemGroupKind }) {
  return (
    <Section className="mb-6">
      <Text className="m-0 mb-3 text-base font-semibold text-zinc-900">
        <Trans id="store.items.title" />
      </Text>
      <Vtex.Group
        by="packageId"
        fallback={
          <Text className="m-0 text-sm text-zinc-500">
            <Trans id="store.items.empty" />
          </Text>
        }
        path="items"
      >
        <Section>{groupBody(kind)}</Section>
      </Vtex.Group>
    </Section>
  )
}
