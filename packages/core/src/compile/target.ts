import type { EmissionCapability } from '../profile'

import { warningDiagnostic, type Diagnostic } from '../diagnostics'

export function unverifiedCapabilityDiagnostic(
  capability: Pick<EmissionCapability, 'name' | 'evidence'>,
  templateId: string,
): Diagnostic | null {
  if (capability.evidence === 'verified') return null
  return warningDiagnostic(
    'TARGET001',
    `Capability ${capability.name} is ${capability.evidence} and is not verified on the destination.`,
    { templateId, capability: { name: capability.name, evidence: capability.evidence } },
  )
}
