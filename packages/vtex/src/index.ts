import type { Profile } from '@vtex-email/core'

import { messageCenterEmission } from './capabilities'
import { messageCenterSimulator } from './simulator'

export { messageCenterEmission } from './capabilities'
export { messageCenterSimulator } from './simulator'

export const p0Profile: Profile = {
  ...messageCenterEmission,
  helpers: messageCenterSimulator.helpers,
}
