import { execFileSync } from 'node:child_process'

import { evaluateRequiredChecks } from '../tooling/release/wait-for-ci.mjs'

const sha = process.env.RELEASE_COMMIT_SHA || process.env.GITHUB_SHA
if (!sha) {
  console.error('RELEASE_COMMIT_SHA or GITHUB_SHA is required')
  process.exit(1)
}

const required = (process.env.REQUIRED_CHECK_NAMES || 'ci-result,pack-release-artifacts')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const timeoutMs = Number(process.env.WAIT_FOR_CI_TIMEOUT_MS || 45 * 60 * 1000)
const pollMs = Number(process.env.WAIT_FOR_CI_POLL_MS || 15_000)
const started = Date.now()

function listChecks() {
  const stdout = execFileSync(
    'gh',
    ['api', `repos/${process.env.GITHUB_REPOSITORY}/commits/${sha}/check-runs`, '--paginate'],
    { encoding: 'utf8' },
  )
  const parsed = JSON.parse(stdout)
  return Array.isArray(parsed) ? parsed.flatMap((page) => page.check_runs ?? page) : (parsed.check_runs ?? [])
}

if (process.env.SKIP_WAIT_FOR_CI === '1' || process.env.SKIP_WAIT_FOR_CI === 'true') {
  console.log('SKIP_WAIT_FOR_CI set; not waiting')
  process.exit(0)
}

while (true) {
  const runs = listChecks()
  const result = evaluateRequiredChecks({ runs, required })
  console.log(`[wait-for-ci] ${result.detail}`)
  if (result.ready) {
    if (!result.ok) process.exit(1)
    process.exit(0)
  }
  if (Date.now() - started > timeoutMs) {
    console.error(`Timed out waiting for CI on ${sha}`)
    process.exit(1)
  }
  await new Promise((resolve) => setTimeout(resolve, pollMs))
}
