import { describe, expect, it } from 'vitest'

import {
  buildPublishGraph,
  detectBumpedNames,
  formatPublishPlan,
  parseNpmVersions,
  planPublish,
  publishInOrder,
  selectDistTag,
  selectReleaseCohort,
  topologicalSort,
} from './publish-plan.mjs'

function pkg(
  name: string,
  version: string,
  deps: Record<string, string> = {},
  options: { private?: boolean; dir?: string } = {},
) {
  return {
    dir: options.dir ?? `/tmp/${name}`,
    packageJson: {
      name,
      version,
      private: options.private,
      dependencies: deps,
    },
  }
}

describe('parseNpmVersions', () => {
  it('returns versions on success', () => {
    expect(parseNpmVersions('demo', { exitCode: 0, stdout: '["1.0.0","1.0.1"]', stderr: '' })).toEqual([
      '1.0.0',
      '1.0.1',
    ])
  })

  it('treats E404 as unpublished', () => {
    expect(
      parseNpmVersions('demo', {
        exitCode: 1,
        stdout: '',
        stderr: 'npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/demo',
      }),
    ).toEqual([])
  })

  it('throws on auth/network style errors', () => {
    expect(() =>
      parseNpmVersions('demo', {
        exitCode: 1,
        stdout: '',
        stderr: 'npm error code E401\nnpm error Incorrect or missing password',
      }),
    ).toThrow(/Failed to read published versions/)
  })
})

describe('selectDistTag', () => {
  it('uses latest for stable and prerelease id otherwise', () => {
    expect(selectDistTag('1.2.3')).toBe('latest')
    expect(selectDistTag('1.2.3-canary.1')).toBe('canary')
  })
})

describe('graph and order', () => {
  it('orders core before dependents', () => {
    const packages = [
      pkg('@vtex-email/preview', '0.2.0', { '@vtex-email/cli': '0.1.0' }),
      pkg('@vtex-email/cli', '0.1.0', { '@vtex-email/core': '0.1.0' }),
      pkg('@vtex-email/core', '0.1.0'),
    ]
    const graph = buildPublishGraph(packages)
    expect(topologicalSort(graph)).toEqual(['@vtex-email/core', '@vtex-email/cli', '@vtex-email/preview'])
  })
})

describe('selectReleaseCohort', () => {
  it('ignores packages not bumped even if unpublished', () => {
    const packages = [
      pkg('@vtex-email/core', '0.0.0'),
      pkg('@vtex-email/preview', '0.1.0'),
      pkg('@vtex-email/example', '0.0.0', {}, { private: true }),
    ]
    const cohort = selectReleaseCohort({
      packages,
      bumpedNames: new Set(['@vtex-email/preview']),
    })
    expect(cohort.map((item) => item.name)).toEqual(['@vtex-email/preview'])
  })
})

describe('planPublish', () => {
  it('skips already published versions for resume', async () => {
    const cohort = selectReleaseCohort({
      packages: [pkg('@vtex-email/core', '0.1.0'), pkg('@vtex-email/cli', '0.1.0', { '@vtex-email/core': '0.1.0' })],
      bumpedNames: new Set(['@vtex-email/core', '@vtex-email/cli']),
    })
    const plan = await planPublish({
      cohort,
      getPublishedVersions: async (name) => (name === '@vtex-email/core' ? ['0.1.0'] : []),
    })
    expect(plan.alreadyPublished).toEqual(['@vtex-email/core@0.1.0'])
    expect(plan.ordered.map((item) => item.name)).toEqual(['@vtex-email/cli'])
  })

  it('reports empty plan when nothing pending', async () => {
    const cohort = selectReleaseCohort({
      packages: [pkg('@vtex-email/preview', '0.7.0')],
      bumpedNames: new Set(['@vtex-email/preview']),
    })
    const plan = await planPublish({
      cohort,
      getPublishedVersions: async () => ['0.7.0'],
    })
    expect(formatPublishPlan(plan)).toContain('No packages need publishing')
  })
})

describe('publishInOrder', () => {
  it('skips dependents when a dependency fails', async () => {
    const packages = [
      pkg('@vtex-email/core', '0.1.0'),
      pkg('@vtex-email/cli', '0.1.0', { '@vtex-email/core': '0.1.0' }),
      pkg('@vtex-email/preview', '0.1.0', { '@vtex-email/cli': '0.1.0' }),
    ]
    const graph = buildPublishGraph(packages)
    const ordered = topologicalSort(graph)
    const result = await publishInOrder(ordered, graph, async (name) => name !== '@vtex-email/cli')
    expect(result.published).toEqual(['@vtex-email/core'])
    expect(result.failed).toEqual(['@vtex-email/cli'])
    expect(result.skipped).toEqual(['@vtex-email/preview'])
  })
})

describe('detectBumpedNames', () => {
  it('requires previous version and a change', () => {
    const before = new Map([
      ['@vtex-email/core', '0.0.0'],
      ['@vtex-email/preview', '0.0.0'],
    ])
    const bumped = detectBumpedNames(before, [
      { name: '@vtex-email/core', version: '0.0.0' },
      { name: '@vtex-email/preview', version: '0.1.0' },
      { name: '@vtex-email/new', version: '0.0.0' },
    ])
    expect([...bumped]).toEqual(['@vtex-email/preview'])
  })
})
