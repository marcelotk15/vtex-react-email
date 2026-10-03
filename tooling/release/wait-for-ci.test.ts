import { describe, expect, it } from 'vitest'

import { evaluateRequiredChecks } from './wait-for-ci.mjs'

describe('evaluateRequiredChecks', () => {
  const required = ['ci-result', 'pack-release-artifacts']

  it('waits while checks are missing', () => {
    expect(evaluateRequiredChecks({ runs: [], required })).toEqual({
      ready: false,
      ok: false,
      detail: 'waiting for checks: ci-result, pack-release-artifacts',
    })
  })

  it('fails when a required check failed', () => {
    expect(
      evaluateRequiredChecks({
        required,
        runs: [
          { name: 'ci-result', status: 'completed', conclusion: 'failure' },
          { name: 'pack-release-artifacts', status: 'completed', conclusion: 'success' },
        ],
      }).ok,
    ).toBe(false)
  })

  it('succeeds only when the same required checks are green', () => {
    expect(
      evaluateRequiredChecks({
        required,
        runs: [
          { name: 'ci-result', status: 'completed', conclusion: 'success' },
          { name: 'pack-release-artifacts', status: 'completed', conclusion: 'success' },
          { name: 'unrelated', status: 'completed', conclusion: 'failure' },
        ],
      }),
    ).toEqual({ ready: true, ok: true, detail: 'all required checks succeeded' })
  })
})
