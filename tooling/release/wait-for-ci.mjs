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
