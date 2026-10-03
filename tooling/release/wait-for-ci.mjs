/**
 * Pure evaluation of GitHub check-runs for the publish gate.
 *
 * @param {{
 *   runs: ReadonlyArray<{ name?: string, status?: string, conclusion?: string | null }>
 *   required: readonly string[]
 * }} options
 */
export function evaluateRequiredChecks(options) {
  /** @type {Record<string, { conclusion: string | null, status: string }>} */
  const byName = {}
  for (const run of options.runs) {
    const name = run.name
    if (!name || !options.required.includes(name)) continue
    const previous = byName[name]
    if (!previous || run.status === 'completed') {
      byName[name] = { conclusion: run.conclusion ?? null, status: run.status ?? 'queued' }
    }
  }

  const missing = options.required.filter((name) => !byName[name])
  if (missing.length > 0) {
    return { ready: false, ok: false, detail: `waiting for checks: ${missing.join(', ')}` }
  }

  const pending = options.required.filter((name) => byName[name].status !== 'completed')
  if (pending.length > 0) {
    return { ready: false, ok: false, detail: `in progress: ${pending.join(', ')}` }
  }

  const failed = options.required.filter((name) => byName[name].conclusion !== 'success')
  if (failed.length > 0) {
    return {
      ready: true,
      ok: false,
      detail: `failed checks: ${failed.map((name) => `${name}=${byName[name].conclusion}`).join(', ')}`,
    }
  }
  return { ready: true, ok: true, detail: 'all required checks succeeded' }
}

const ACTIONS_RUN_ID_RE = /\/actions\/runs\/(\d+)(?:\/|$)/

/**
 * Extract a GitHub Actions workflow run id from a check-run details_url.
 *
 * @param {string | null | undefined} detailsUrl
 * @returns {string | null}
 */
export function extractWorkflowRunIdFromDetailsUrl(detailsUrl) {
  if (!detailsUrl) return null
  const match = ACTIONS_RUN_ID_RE.exec(detailsUrl)
  return match?.[1] ?? null
}

/**
 * Resolve the workflow run id for a successful completed check-run.
 * When multiple completed successes exist for the same name, the last one in
 * `runs` wins (aligned with evaluateRequiredChecks overwrite semantics).
 *
 * @param {{
 *   runs: ReadonlyArray<{
 *     name?: string
 *     status?: string
 *     conclusion?: string | null
 *     details_url?: string | null
 *   }>
 *   checkName: string
 * }} options
 * @returns {string | null}
 */
export function resolveWorkflowRunIdFromCheck(options) {
  let runId = null
  for (const run of options.runs) {
    if (run.name !== options.checkName) continue
    if (run.status !== 'completed' || run.conclusion !== 'success') continue
    const extracted = extractWorkflowRunIdFromDetailsUrl(run.details_url)
    if (extracted) runId = extracted
  }
  return runId
}
