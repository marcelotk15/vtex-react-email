import { describe, expect, it } from 'vitest'

import { buildReport } from './report'

describe('capability report', () => {
  it('reads the capability from the diagnostic instead of the sentence', () => {
    const report = buildReport({
      command: 'validate',
      ok: true,
      exitCode: 0,
      diagnostics: [
        {
          code: 'TARGET001',
          severity: 'warning',
          message: 'not the sentence the report used to parse',
          templateId: 'order-confirmed',
          capability: { name: 'eq', evidence: 'experimental' },
        },
      ],
      manifest: null,
      wrote: [],
      preserved: [],
      configDir: '/tmp/vtex-report-project',
    })
    expect(report.unverifiedCapabilities).toEqual([
      { templateId: 'order-confirmed', name: 'eq', evidence: 'experimental', severity: 'warning' },
    ])
  })
})
