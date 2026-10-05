import type { EmailSettings } from '@vtex-email/core'

import { Greeting } from '../components/store/greeting'
import { OrderIntro } from '../components/store/intro'
import { ItemGroup } from '../components/store/items'
import { StoreShell } from '../components/store/shell'
import { OrderSummary } from '../components/store/summary'

export const settings = {
  i18n: {
    localePath: 'clientPreferencesData.locale',
    output: 'per-locale',
  },
} satisfies EmailSettings

export default function Refund() {
  return (
    <StoreShell>
      <Greeting />
      <OrderIntro messageId="store.intro.refund" />
      <ItemGroup kind="simple" />
      <OrderSummary />
    </StoreShell>
  )
}
