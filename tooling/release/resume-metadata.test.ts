import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  classifyPublishResult,
  completeReleaseMetadata,
  ensureGitTag,
  ensureGithubRelease,
  shouldUpdateDistTag,
  writeChangesetsOutput,
} from './resume-metadata.mjs'

const tempDirs: string[] = []
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('classifyPublishResult', () => {
  it('detects success', () => {
    expect(classifyPublishResult({ exitCode: 0, stdout: 'ok', stderr: '' }).kind).toBe('published')
  })

  it('ignores legacy code field without exitCode', () => {
    expect(classifyPublishResult({ code: 0, stdout: 'ok', stderr: '' } as { exitCode?: number }).kind).toBe('failed')
  })

  it('detects already-exists after lost response', () => {
    expect(
      classifyPublishResult({
        exitCode: 1,
        stdout: '',
        stderr: 'npm error code E409\nnpm error cannot publish over the previously published versions',
      }).kind,
    ).toBe('already_exists')
  })

  it('detects auth errors as real failures', () => {
    expect(
      classifyPublishResult({
        exitCode: 1,
        stdout: '',
        stderr: 'npm error code ENEEDAUTH\nnpm error Unable to authenticate',
      }).kind,
    ).toBe('auth_error')
  })
})

describe('writeChangesetsOutput', () => {
  it('writes NDJSON git-tag events for confirmed packages only', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vtex-cs-out-'))
    tempDirs.push(dir)
    const outputPath = path.join(dir, 'events.ndjson')
    writeChangesetsOutput({
      outputPath,
      packages: [{ name: '@vtex-email/core', version: '0.1.0' }],
    })
    expect(await readFile(outputPath, 'utf8')).toBe(
      '{"type":"git-tag","tag":"@vtex-email/core@0.1.0","packageName":"@vtex-email/core"}\n',
    )
  })
})

describe('shouldUpdateDistTag', () => {
  it('allows advancing latest', () => {
    expect(shouldUpdateDistTag({ version: '0.2.0', distTag: 'latest', currentLatest: '0.1.0' })).toBe(true)
  })

  it('blocks regressing latest when resuming an older release', () => {
    expect(shouldUpdateDistTag({ version: '0.1.0', distTag: 'latest', currentLatest: '0.2.0' })).toBe(false)
  })

  it('always allows non-latest tags', () => {
    expect(shouldUpdateDistTag({ version: '0.1.0', distTag: 'canary', currentLatest: '0.2.0' })).toBe(true)
  })
})

describe('ensureGitTag / ensureGithubRelease / completeReleaseMetadata', () => {
  it('creates missing tag and release', () => {
    const createTag = vi.fn()
    const pushTag = vi.fn()
    const createRelease = vi.fn()
    expect(
      ensureGitTag({
        tag: '@vtex-email/preview@0.1.0',
        commitSha: 'abc',
        git: () => '',
        tagExists: () => false,
        createTag,
        pushTag,
      }).status,
    ).toBe('created')
    expect(createTag).toHaveBeenCalledWith('@vtex-email/preview@0.1.0', 'abc')
    expect(pushTag).toHaveBeenCalled()

    expect(
      ensureGithubRelease({
        tag: '@vtex-email/preview@0.1.0',
        title: '@vtex-email/preview@0.1.0',
        commitSha: 'abc',
        releaseExists: () => false,
        createRelease,
      }).status,
    ).toBe('created')
  })

  it('fails when an existing tag points at the wrong commit', () => {
    expect(() =>
      ensureGitTag({
        tag: '@vtex-email/preview@0.1.0',
        commitSha: 'abc',
        git: () => 'different\n',
        tagExists: () => true,
        createTag: () => {},
        pushTag: () => {},
      }),
    ).toThrow(/already exists/)
  })

  it('completes metadata even when publish cohort was already on the registry', () => {
    const results = completeReleaseMetadata({
      packages: [{ name: '@vtex-email/preview', version: '0.1.0' }],
      commitSha: 'deadbeef',
      adapters: {
        git: () => 'deadbeef',
        tagExists: () => true,
        createTag: () => {},
        pushTag: () => {},
        releaseExists: () => false,
        createRelease: vi.fn(),
      },
    })
    expect(results).toEqual([{ tag: '@vtex-email/preview@0.1.0', tagStatus: 'exists', releaseStatus: 'created' }])
  })
})
