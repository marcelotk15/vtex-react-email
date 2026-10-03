import { describe, expect, it } from 'vitest'

import {
  evaluateRequiredChecks,
  extractWorkflowRunIdFromDetailsUrl,
  resolveWorkflowRunIdFromCheck,
} from './wait-for-ci.mjs'

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

describe('resolveWorkflowRunIdFromCheck', () => {
  it('extracts run id from a successful pack check details_url', () => {
    expect(
      extractWorkflowRunIdFromDetailsUrl(
        'https://github.com/marcelotk15/vtex-react-email/actions/runs/123456789/job/987',
      ),
    ).toBe('123456789')

    expect(
      resolveWorkflowRunIdFromCheck({
        checkName: 'pack-release-artifacts',
        runs: [
          {
            name: 'pack-release-artifacts',
            status: 'completed',
            conclusion: 'success',
            details_url: 'https://github.com/o/r/actions/runs/111/job/1',
          },
        ],
      }),
    ).toBe('111')
  })

  it('ignores completed failures and unrelated checks', () => {
    expect(
      resolveWorkflowRunIdFromCheck({
        checkName: 'pack-release-artifacts',
        runs: [
          {
            name: 'pack-release-artifacts',
            status: 'completed',
            conclusion: 'failure',
            details_url: 'https://github.com/o/r/actions/runs/222/job/1',
          },
          {
            name: 'ci-result',
            status: 'completed',
            conclusion: 'success',
            details_url: 'https://github.com/o/r/actions/runs/333/job/1',
          },
        ],
      }),
    ).toBeNull()
  })

  it('prefers the last successful completed pack check when re-runs exist', () => {
    expect(
      resolveWorkflowRunIdFromCheck({
        checkName: 'pack-release-artifacts',
        runs: [
          {
            name: 'pack-release-artifacts',
            status: 'completed',
            conclusion: 'success',
            details_url: 'https://github.com/o/r/actions/runs/100/job/1',
          },
          {
            name: 'pack-release-artifacts',
            status: 'completed',
            conclusion: 'failure',
            details_url: 'https://github.com/o/r/actions/runs/200/job/1',
          },
          {
            name: 'pack-release-artifacts',
            status: 'completed',
            conclusion: 'success',
            details_url: 'https://github.com/o/r/actions/runs/300/job/1',
          },
        ],
      }),
    ).toBe('300')
  })

  it('returns null when success lacks a usable details_url', () => {
    expect(
      resolveWorkflowRunIdFromCheck({
        checkName: 'pack-release-artifacts',
        runs: [
          {
            name: 'pack-release-artifacts',
            status: 'completed',
            conclusion: 'success',
            details_url: 'https://github.com/o/r/runs/999',
          },
        ],
      }),
    ).toBeNull()
  })
})
