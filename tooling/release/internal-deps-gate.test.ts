import { describe, expect, it } from 'vitest'

import { assertInternalDependenciesAvailable, normalizePublishedRange } from './internal-deps-gate.mjs'

describe('normalizePublishedRange', () => {
  it('maps workspace:* to *', () => {
    expect(normalizePublishedRange('workspace:*')).toBe('*')
  })

  it('keeps concrete ranges', () => {
    expect(normalizePublishedRange('0.1.0')).toBe('0.1.0')
  })
})

describe('assertInternalDependenciesAvailable', () => {
  const workspaceNames = new Set(['@vtex-email/cli', '@vtex-email/preview', '@vtex-email/core'])

  it('blocks Preview-only publish when CLI is missing from registry and cohort', async () => {
    await expect(
      assertInternalDependenciesAvailable({
        cohort: [
          {
            name: '@vtex-email/preview',
            version: '0.1.0',
            packageJson: {
              name: '@vtex-email/preview',
              dependencies: { '@vtex-email/cli': '0.1.0' },
            },
          },
        ],
        workspaceNames,
        getPublishedVersions: async () => [],
        tarballDependencies: new Map([['@vtex-email/preview', { '@vtex-email/cli': '0.1.0' }]]),
      }),
    ).rejects.toThrow(/Internal dependency gate failed/)
  })

  it('allows Preview when CLI is published at a compatible version', async () => {
    await expect(
      assertInternalDependenciesAvailable({
        cohort: [
          {
            name: '@vtex-email/preview',
            version: '0.1.0',
            packageJson: {
              name: '@vtex-email/preview',
              dependencies: { '@vtex-email/cli': 'workspace:*' },
            },
          },
        ],
        workspaceNames,
        getPublishedVersions: async (name) => (name === '@vtex-email/cli' ? ['0.1.0'] : []),
        tarballDependencies: new Map([['@vtex-email/preview', { '@vtex-email/cli': '0.1.0' }]]),
      }),
    ).resolves.toBeUndefined()
  })

  it('allows publishing Preview with CLI in the same cohort', async () => {
    await expect(
      assertInternalDependenciesAvailable({
        cohort: [
          {
            name: '@vtex-email/cli',
            version: '0.1.0',
            packageJson: { name: '@vtex-email/cli', dependencies: { '@vtex-email/core': '0.1.0' } },
          },
          {
            name: '@vtex-email/preview',
            version: '0.1.0',
            packageJson: {
              name: '@vtex-email/preview',
              dependencies: { '@vtex-email/cli': '0.1.0' },
            },
          },
          {
            name: '@vtex-email/core',
            version: '0.1.0',
            packageJson: { name: '@vtex-email/core' },
          },
        ],
        workspaceNames,
        getPublishedVersions: async () => [],
      }),
    ).resolves.toBeUndefined()
  })
})
