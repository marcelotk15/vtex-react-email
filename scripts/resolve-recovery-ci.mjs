import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

import { assertFullSha, selectSuccessfulMainPushCiRun } from '../tooling/release/recover-release.mjs'
import { evaluateRequiredChecks, resolveWorkflowRunIdFromCheck } from '../tooling/release/wait-for-ci.mjs'

const releaseSha = assertFullSha(process.env.RELEASE_SHA)
const repository = process.env.GITHUB_REPOSITORY
if (!repository) {
  console.error('GITHUB_REPOSITORY is required')
  process.exit(1)
}

const required = (process.env.REQUIRED_CHECK_NAMES || 'ci-result,pack-release-artifacts')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const packArtifactCheckName = process.env.PACK_ARTIFACT_CHECK_NAME || 'pack-release-artifacts'

function ghApi(path) {
  return JSON.parse(
    execFileSync('gh', ['api', path, '--paginate'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )
}

function listWorkflowRuns() {
  const parsed = ghApi(
    `repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${releaseSha}&event=push&status=completed&per_page=100`,
  )
  const runs = Array.isArray(parsed) ? parsed.flatMap((page) => page.workflow_runs ?? []) : (parsed.workflow_runs ?? [])
  return runs
}

function listChecks() {
  const parsed = ghApi(`repos/${repository}/commits/${releaseSha}/check-runs`)
  return Array.isArray(parsed) ? parsed.flatMap((page) => page.check_runs ?? page) : (parsed.check_runs ?? [])
}

const runs = listWorkflowRuns()
const runId = selectSuccessfulMainPushCiRun({ runs, headSha: releaseSha })

const checks = listChecks()
const checkResult = evaluateRequiredChecks({ runs: checks, required })
if (!checkResult.ready || !checkResult.ok) {
  console.error(`Required checks are not green for ${releaseSha}: ${checkResult.detail}`)
  process.exit(1)
}

const checkRunId = resolveWorkflowRunIdFromCheck({ runs: checks, checkName: packArtifactCheckName })
if (checkRunId && checkRunId !== runId) {
  // Prefer the push CI run selected above; warn when check details_url points elsewhere.
  console.warn(
    `[resolve-recovery-ci] pack check details_url run_id=${checkRunId} differs from selected push CI run_id=${runId}; using push CI run`,
  )
}

console.log(`[resolve-recovery-ci] release_sha=${releaseSha} run_id=${runId}`)

const outputPath = process.env.GITHUB_OUTPUT
if (outputPath) {
  appendFileSync(outputPath, `run_id=${runId}\n`, 'utf8')
} else {
  console.log(`[resolve-recovery-ci] GITHUB_OUTPUT unset; run_id=${runId}`)
}
