import { Column, Row, Text } from '@react-email/components'
import { Trans, Vtex, expr } from '@vtex-email/react'

export function ItemLine(props: { 'data-anchor'?: string }) {
  return (
    <Row className="text-sm text-gray-700" data-anchor={props['data-anchor']}>
      <Column>
        <Vtex.Img alt={expr.path('name')} height={96} src={expr.path('imageUrl')} width={96} />
        <Text className="text-sm text-gray-700">
          <Vtex.Value path="quantity" />
          {' × '}
          <Vtex.Value path="name" />
        </Text>
        <Text>
          <Vtex.Value path="../orderId" />
        </Text>
        <Text>
          {'R$ '}
          <Vtex.Helper args={[expr.path('sellingPrice')]} name="formatCurrency" />
        </Text>
        <Text>
          <Vtex.Helper
            args={[expr.path('shippingEstimate'), expr.literal('bd'), expr.literal(' business days')]}
            name="replace"
          />
        </Text>
        <Vtex.Link href={expr.path('imageUrl')}>
          <Trans id="order.view" />
        </Vtex.Link>
      </Column>
    </Row>
  )
}
