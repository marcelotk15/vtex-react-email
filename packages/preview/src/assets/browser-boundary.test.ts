import { describe, expect, it } from 'vitest'

import { browserImportViolation } from './browser-boundary'

describe('preview interface boundary', () => {
  it('rejects node, compiler, and react-email imports', () => {
    expect(browserImportViolation('./client/preview-client')).toBeNull()
    expect(browserImportViolation('react')).toBeNull()
    expect(browserImportViolation('react-dom/client')).toBeNull()
    for (const specifier of [
      'node:fs',
      'fs',
      '@vtex-email/cli',
      '@vtex-email/react',
      '@react-email/components',
      'react-dom/server',
    ]) {
      expect(browserImportViolation(specifier)).toContain(specifier)
    }
  })
})
