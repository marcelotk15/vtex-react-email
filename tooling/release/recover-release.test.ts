import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadAndVerifyManifest, sha256File } from './pack-artifacts.mjs'
import { planPublish, selectReleaseCohort } from './publish-plan.mjs'
import {
  assertArtifactsMatchCohort,
  assertCommitOnMain,
  assertFullSha,
  loadHistoricalCohort,
  parseAlreadyPublished,
  selectSuccessfulMainPushCiRun,
} from './recover-release.mjs'
import { completeReleaseMetadata, writeChangesetsOutput } from './resume-metadata.mjs'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const RELEASE_SHA = 'e0dcfa43434fc2b469d2e41656ecdcde6bfad69d'
const MAIN_TIP = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('assertFullSha / assertCommitOnMain', () => {
  it('requires a full sha', () => {
    expect(() => assertFullSha('e0dcfa4')).toThrow(/40-character/)
    expect(assertFullSha(RELEASE_SHA)).toBe(RELEASE_SHA)
  })

  it('accepts a release sha still reachable from a newer main tip', () => {
    expect(
      assertCommitOnMain({
        releaseSha: RELEASE_SHA,
        revParse: (ref) => (ref === 'refs/heads/main' ? MAIN_TIP : RELEASE_SHA),
        isAncestor: (ancestor, descendant) => ancestor === RELEASE_SHA && descendant === MAIN_TIP,
      }),
    ).toEqual({ releaseSha: RELEASE_SHA, mainTip: MAIN_TIP })
  })

  it('rejects a sha outside main history', () => {
    expect(() =>
      assertCommitOnMain({
        releaseSha: RELEASE_SHA,
        revParse: (ref) => (ref === 'refs/heads/main' ? MAIN_TIP : RELEASE_SHA),
        isAncestor: () => false,
      }),
    ).toThrow(/not in the history of refs\/heads\/main/)
  })
})

describe('loadHistoricalCohort', () => {
  it('derives bumps from historical package.json only (main may have moved on)', () => {
    const files = new Map<string, string>([
      [`${RELEASE_SHA}:packages/core/package.json`, JSON.stringify({ name: '@vtex-email/core', version: '0.1.0' })],
      [`${RELEASE_SHA}^:packages/core/package.json`, JSON.stringify({ name: '@vtex-email/core', version: '0.0.0' })],
      [
        `${RELEASE_SHA}:packages/cli/package.json`,
        JSON.stringify({
          name: '@vtex-email/cli',
          version: '0.1.0',
          dependencies: { '@vtex-email/core': 'workspace:*' },
        }),
      ],
      [
        `${RELEASE_SHA}^:packages/cli/package.json`,
        JSON.stringify({
          name: '@vtex-email/cli',
          version: '0.0.0',
          dependencies: { '@vtex-email/core': 'workspace:*' },
        }),
      ],
      // Current main tip would show a later version — must be ignored.
      [`${MAIN_TIP}:packages/core/package.json`, JSON.stringify({ name: '@vtex-email/core', version: '0.2.0' })],
    ])

    const result = loadHistoricalCohort({
      releaseSha: RELEASE_SHA,
      packageDirs: ['core', 'cli', 'preview'],
      commitMessage: 'chore(release): version packages',
      gitShow: (ref, file) => files.get(`${ref}:${file}`) ?? null,
    })

    expect([...result.bumpedNames].sort()).toEqual(['@vtex-email/cli', '@vtex-email/core'])
    expect(result.cohort.map((pkg) => `${pkg.name}@${pkg.version}`).sort()).toEqual([
      '@vtex-email/cli@0.1.0',
      '@vtex-email/core@0.1.0',
    ])
  })

  it('requires an approved release commit message', () => {
    expect(() =>
      loadHistoricalCohort({
        releaseSha: RELEASE_SHA,
        packageDirs: ['core'],
        commitMessage: 'fix: something else',
        gitShow: () => JSON.stringify({ name: '@vtex-email/core', version: '0.1.0' }),
      }),
    ).toThrow(/approved release commit/)
  })
})

describe('selectSuccessfulMainPushCiRun', () => {
  it('selects the successful main push CI run and ignores tag events', () => {
    const runId = selectSuccessfulMainPushCiRun({
      headSha: RELEASE_SHA,
      runs: [
        {
          id: 1,
          event: 'push',
          head_sha: RELEASE_SHA,
          head_branch: 'refs/tags/@vtex-email/core@0.1.0',
          status: 'completed',
          conclusion: 'success',
          name: 'ci',
          path: '.github/workflows/ci.yml',
        },
        {
          id: 37098221072,
          event: 'push',
          head_sha: RELEASE_SHA,
          head_branch: 'main',
          status: 'completed',
          conclusion: 'success',
          name: 'ci',
          path: '.github/workflows/ci.yml',
        },
        {
          id: 99,
          event: 'workflow_dispatch',
          head_sha: RELEASE_SHA,
          head_branch: 'main',
          status: 'completed',
          conclusion: 'success',
          name: 'ci',
          path: '.github/workflows/ci.yml',
        },
      ],
    })
    expect(runId).toBe('37098221072')
  })

  it('rejects tag-only matches for the same sha', () => {
    expect(() =>
      selectSuccessfulMainPushCiRun({
        headSha: RELEASE_SHA,
        runs: [
          {
            id: 1,
            event: 'push',
            head_sha: RELEASE_SHA,
            head_branch: 'v0.1.0',
            status: 'completed',
            conclusion: 'success',
            name: 'ci',
            path: '.github/workflows/ci.yml',
          },
        ],
      }),
    ).toThrow(/No successful main push CI run/)
  })
})

describe('recovery publish planning and metadata', () => {
  it('plans core already published and four packages pending', async () => {
    const packages = [
      { dir: 'packages/core', packageJson: { name: '@vtex-email/core', version: '0.1.0' } },
      {
        dir: 'packages/vtex',
        packageJson: { name: '@vtex-email/vtex', version: '0.1.0', dependencies: { '@vtex-email/core': '0.1.0' } },
      },
      {
        dir: 'packages/react',
        packageJson: { name: '@vtex-email/react', version: '0.1.0', dependencies: { '@vtex-email/core': '0.1.0' } },
      },
      {
        dir: 'packages/cli',
        packageJson: {
          name: '@vtex-email/cli',
          version: '0.1.0',
          dependencies: { '@vtex-email/core': '0.1.0', '@vtex-email/vtex': '0.1.0', '@vtex-email/react': '0.1.0' },
        },
      },
      {
        dir: 'packages/preview',
        packageJson: { name: '@vtex-email/preview', version: '0.1.0', dependencies: { '@vtex-email/cli': '0.1.0' } },
      },
    ]
    const cohort = selectReleaseCohort({
      packages,
      bumpedNames: new Set(packages.map((pkg) => pkg.packageJson.name)),
    })
    const plan = await planPublish({
      cohort,
      getPublishedVersions: async (name) => (name === '@vtex-email/core' ? ['0.1.0'] : []),
    })
    expect(plan.alreadyPublished).toEqual(['@vtex-email/core@0.1.0'])
    expect(plan.ordered.map((item) => item.name)).toEqual([
      '@vtex-email/react',
      '@vtex-email/vtex',
      '@vtex-email/cli',
      '@vtex-email/preview',
    ])
  })

  it('writes metadata and CHANGESETS_OUTPUT only for confirmed packages', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vtex-changesets-out-'))
    tempDirs.push(dir)
    const outputPath = path.join(dir, 'out.ndjson')
    const createTag = vi.fn()
    const createRelease = vi.fn()

    const confirmed = [
      { name: '@vtex-email/core', version: '0.1.0' },
      { name: '@vtex-email/vtex', version: '0.1.0' },
    ]
    const skipped = [{ name: '@vtex-email/cli', version: '0.1.0' }]

    const results = completeReleaseMetadata({
      packages: confirmed,
      commitSha: RELEASE_SHA,
      adapters: {
        git: () => RELEASE_SHA,
        tagExists: () => false,
        createTag,
        pushTag: () => {},
        releaseExists: () => false,
        createRelease,
      },
    })
    expect(results).toHaveLength(2)
    expect(createTag).toHaveBeenCalledTimes(2)
    expect(createTag.mock.calls.map((call) => call[0])).not.toContain('@vtex-email/cli@0.1.0')
    expect(skipped).toHaveLength(1)

    writeChangesetsOutput({ outputPath, packages: confirmed })
    const raw = await import('node:fs/promises').then((fs) => fs.readFile(outputPath, 'utf8'))
    const events = raw
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(events).toEqual([
      { type: 'git-tag', tag: '@vtex-email/core@0.1.0', packageName: '@vtex-email/core' },
      { type: 'git-tag', tag: '@vtex-email/vtex@0.1.0', packageName: '@vtex-email/vtex' },
    ])
  })

  it('treats a fully published cohort as already done without republishing', async () => {
    const cohort = selectReleaseCohort({
      packages: [
        { dir: 'packages/core', packageJson: { name: '@vtex-email/core', version: '0.1.0' } },
        { dir: 'packages/cli', packageJson: { name: '@vtex-email/cli', version: '0.1.0' } },
      ],
      bumpedNames: new Set(['@vtex-email/core', '@vtex-email/cli']),
    })
    const plan = await planPublish({
      cohort,
      getPublishedVersions: async () => ['0.1.0'],
    })
    expect(plan.ordered).toEqual([])
    expect(parseAlreadyPublished(plan.alreadyPublished)).toEqual([
      { name: '@vtex-email/core', version: '0.1.0' },
      { name: '@vtex-email/cli', version: '0.1.0' },
    ])

    const createTag = vi.fn()
    completeReleaseMetadata({
      packages: parseAlreadyPublished(plan.alreadyPublished),
      commitSha: RELEASE_SHA,
      adapters: {
        git: () => RELEASE_SHA,
        tagExists: () => true,
        createTag,
        pushTag: () => {},
        releaseExists: () => true,
        createRelease: () => {},
      },
    })
    expect(createTag).not.toHaveBeenCalled()
  })
})

describe('artifact verification for recovery', () => {
  it('rejects manifests without commit SHA when expectedCommit is set', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vtex-art-'))
    tempDirs.push(dir)
    await writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify({ packages: [] }, null, 2)}\n`)
    await expect(
      loadAndVerifyManifest({
        manifestPath: path.join(dir, 'manifest.json'),
        artifactsDir: dir,
        expectedCommit: RELEASE_SHA,
      }),
    ).rejects.toThrow(/missing required commit SHA/)
  })

  it('rejects wrong commit SHA and tarball identity mismatches', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vtex-art-'))
    tempDirs.push(dir)
    const tarball = path.join(dir, 'pkg.tgz')
    // Minimal gzip+tar with package/package.json via writing a fake then skipping deep pack —
    // use verifyTarballPackageJson false for hash/commit checks, then assert cohort matcher.
    await writeFile(tarball, 'not-a-real-tarball')
    const digest = await sha256File(tarball)
    await writeFile(
      path.join(dir, 'manifest.json'),
      `${JSON.stringify(
        {
          commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          packages: [{ dir: 'core', name: '@vtex-email/core', version: '0.1.0', file: 'pkg.tgz', sha256: digest }],
        },
        null,
        2,
      )}\n`,
    )

    await expect(
      loadAndVerifyManifest({
        manifestPath: path.join(dir, 'manifest.json'),
        artifactsDir: dir,
        expectedCommit: RELEASE_SHA,
        verifyTarballPackageJson: false,
      }),
    ).rejects.toThrow(/does not match expected/)

    expect(() =>
      assertArtifactsMatchCohort({
        cohort: [{ name: '@vtex-email/core', version: '0.1.0' }],
        artifacts: [{ name: '@vtex-email/core', version: '0.2.0' }],
      }),
    ).toThrow(/version mismatch/)
  })

  it('rejects hash mismatches', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vtex-art-'))
    tempDirs.push(dir)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'pkg.tgz'), 'abc')
    await writeFile(
      path.join(dir, 'manifest.json'),
      `${JSON.stringify(
        {
          commit: RELEASE_SHA,
          packages: [
            {
              dir: 'core',
              name: '@vtex-email/core',
              version: '0.1.0',
              file: 'pkg.tgz',
              sha256: '0'.repeat(64),
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    await expect(
      loadAndVerifyManifest({
        manifestPath: path.join(dir, 'manifest.json'),
        artifactsDir: dir,
        expectedCommit: RELEASE_SHA,
        verifyTarballPackageJson: false,
      }),
    ).rejects.toThrow(/Hash mismatch/)
  })
})
