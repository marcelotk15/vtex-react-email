/** @param {string | undefined | null} message */
export function isReleaseCommitMessage(message) {
  const first = (message ?? '').split(/\r?\n/, 1)[0]?.trim() ?? ''
  return /^chore\(release\):\s*version packages\b/i.test(first)
}

/**
 * Selective publish only runs for an approved Version Packages commit
 * (squash-merged Version PR), not for arbitrary manual version edits.
 *
 * @param {{ commitMessage?: string | null }} options
 */
export function assertApprovedReleaseCommit(options) {
  if (!isReleaseCommitMessage(options.commitMessage)) {
    throw new Error(
      'Refusing to publish: HEAD is not an approved release commit (expected message "chore(release): version packages"). Manual version edits are not a release.',
    )
  }
}
