import { describe, expect, it } from 'vitest'

import { assertApprovedReleaseCommit, isReleaseCommitMessage } from './release-commit.mjs'

describe('isReleaseCommitMessage', () => {
  it('accepts the Version Packages squash message', () => {
    expect(isReleaseCommitMessage('chore(release): version packages\n\nBody')).toBe(true)
  })

  it('rejects manual version edits', () => {
    expect(isReleaseCommitMessage('chore: bump preview manually')).toBe(false)
  })
})

describe('assertApprovedReleaseCommit', () => {
  it('throws for non-release commits', () => {
    expect(() => assertApprovedReleaseCommit({ commitMessage: 'feat: something' })).toThrow(/Refusing to publish/)
  })
})
