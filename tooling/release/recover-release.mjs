import { detectBumpedNames, selectReleaseCohort } from './publish-plan.mjs'
import { assertApprovedReleaseCommit } from './release-commit.mjs'

export const FULL_SHA_RE = /^[0-9a-f]{40}$/i

/**
 * @param {string | undefined | null} sha
 * @returns {string}
 */
export function assertFullSha(sha) {
  const value = (sha ?? '').trim()
  if (!FULL_SHA_RE.test(value)) {
    throw new Error(`release_sha must be a full 40-character commit SHA (got ${JSON.stringify(sha)})`)
  }
  return value.toLowerCase()
}

/**
 * Ensure the release commit exists and is an ancestor of main (or is main tip).
 *
 * @param {{
 *   releaseSha: string
 *   mainRef?: string
 *   revParse: (ref: string) => string
 *   isAncestor: (ancestor: string, descendant: string) => boolean
 * }} options
 */
export function assertCommitOnMain(options) {
  const releaseSha = assertFullSha(options.releaseSha)
  const mainRef = options.mainRef ?? 'refs/heads/main'
  let mainTip
  try {
    mainTip = options.revParse(mainRef).trim().toLowerCase()
  } catch (error) {
    throw new Error(`Could not resolve ${mainRef}: ${error instanceof Error ? error.message : String(error)}`)
  }

  let resolved
  try {
    resolved = options.revParse(releaseSha).trim().toLowerCase()
  } catch {
    throw new Error(`release_sha ${releaseSha} does not exist in this repository`)
  }
  if (resolved !== releaseSha) {
    throw new Error(`release_sha must be a full commit object id (resolved ${resolved})`)
  }

  if (releaseSha !== mainTip && !options.isAncestor(releaseSha, mainTip)) {
    throw new Error(`release_sha ${releaseSha} is not in the history of ${mainRef} (${mainTip})`)
  }
  return { releaseSha, mainTip }
}

/**
 * Build the release cohort from historical package.json at releaseSha vs its first parent.
 * Does not read working-tree / current main package.json files.
 *
 * @param {{
 *   releaseSha: string
 *   packageDirs: readonly string[]
 *   gitShow: (ref: string, file: string) => string | null
 *   commitMessage: string
 * }} options
 */
export function loadHistoricalCohort(options) {
  const releaseSha = assertFullSha(options.releaseSha)
  assertApprovedReleaseCommit({ commitMessage: options.commitMessage })

  /** @type {Map<string, string>} */
  const before = new Map()
  /** @type {Array<{ dir: string, packageJson: Record<string, unknown> }>} */
  const packages = []

  for (const dirName of options.packageDirs) {
    const file = `packages/${dirName}/package.json`
    const afterRaw = options.gitShow(releaseSha, file)
    if (!afterRaw) continue
    const afterJson = JSON.parse(afterRaw)
    packages.push({
      dir: `packages/${dirName}`,
      packageJson: afterJson,
    })

    const beforeRaw = options.gitShow(`${releaseSha}^`, file)
    if (!beforeRaw) continue
    const beforeJson = JSON.parse(beforeRaw)
    before.set(beforeJson.name, beforeJson.version)
  }

  if (before.size === 0) {
    throw new Error(`Could not read parent package.json files for release_sha ${releaseSha}`)
  }

  const after = packages.map((pkg) => ({
    name: /** @type {string} */ (pkg.packageJson.name),
    version: /** @type {string} */ (pkg.packageJson.version),
    private: /** @type {boolean | undefined} */ (pkg.packageJson.private),
  }))
  const bumpedNames = detectBumpedNames(before, after)
  const cohort = selectReleaseCohort({ packages, bumpedNames })
  return { releaseSha, bumpedNames, packages, cohort }
}

/**
 * Pick the successful CI workflow run for a main push at exactly headSha.
 * Ignores tag-triggered (and other non-push) runs that share the same SHA.
 *
 * @param {{
 *   runs: ReadonlyArray<{
 *     id?: number | string
 *     event?: string
 *     head_sha?: string
 *     head_branch?: string | null
 *     status?: string
 *     conclusion?: string | null
 *     name?: string
 *     path?: string
 *   }>
 *   headSha: string
 *   workflowName?: string
 *   workflowPath?: string
 * }} options
 * @returns {string}
 */
export function selectSuccessfulMainPushCiRun(options) {
  const headSha = assertFullSha(options.headSha)
  const workflowName = options.workflowName ?? 'ci'
  const workflowPath = options.workflowPath ?? '.github/workflows/ci.yml'

  const matches = options.runs.filter((run) => {
    if ((run.head_sha ?? '').toLowerCase() !== headSha) return false
    if (run.event !== 'push') return false
    if (run.status !== 'completed' || run.conclusion !== 'success') return false
    const branch = run.head_branch ?? ''
    if (branch !== 'main' && branch !== 'refs/heads/main') return false
    const pathOk = run.path === workflowPath
    const nameOk = run.name === workflowName
    return pathOk || nameOk
  })

  if (matches.length === 0) {
    throw new Error(`No successful main push CI run found for ${headSha} (workflow ${workflowName} / ${workflowPath})`)
  }

  // Prefer the highest numeric id (latest successful matching run).
  matches.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
  const selected = matches[0]
  if (selected.id === undefined || selected.id === null) {
    throw new Error(`Matched CI run for ${headSha} is missing id`)
  }
  return String(selected.id)
}

/**
 * Ensure every authorized cohort package has a matching verified artifact.
 *
 * @param {{
 *   cohort: ReadonlyArray<{ name: string, version: string }>
 *   artifacts: ReadonlyArray<{ name: string, version: string }>
 * }} options
 */
export function assertArtifactsMatchCohort(options) {
  const byName = new Map(options.artifacts.map((item) => [item.name, item]))
  for (const pkg of options.cohort) {
    const artifact = byName.get(pkg.name)
    if (!artifact) {
      throw new Error(`Missing packed artifact for authorized cohort package ${pkg.name}`)
    }
    if (artifact.version !== pkg.version) {
      throw new Error(`Artifact version mismatch for ${pkg.name}: cohort ${pkg.version}, artifact ${artifact.version}`)
    }
  }
}

/**
 * Parse already-published entries from planPublish into {name, version} objects.
 *
 * @param {readonly string[]} alreadyPublished
 * @returns {Array<{ name: string, version: string }>}
 */
export function parseAlreadyPublished(alreadyPublished) {
  return alreadyPublished.map((item) => {
    const at = item.lastIndexOf('@')
    if (at <= 0) throw new Error(`Invalid alreadyPublished entry: ${item}`)
    return { name: item.slice(0, at), version: item.slice(at + 1) }
  })
}
