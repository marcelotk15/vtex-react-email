import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

/**
 * Distinguish "version already on registry" from a real publish failure.
 *
 * @param {{ exitCode?: number, code?: number, stdout?: string, stderr?: string }} result
 */
export function classifyPublishResult(result) {
  const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`
  // Only `exitCode` is authoritative. Legacy `{ code }` must not count as success.
  if (result.exitCode === 0) return { kind: 'published' }
  if (
    /\bEPUBLISHCONFLICT\b|\bE409\b|cannot publish over the previously published versions|You cannot publish over the previously published/i.test(
      output,
    )
  ) {
    return { kind: 'already_exists' }
  }
  if (/\bENEEDAUTH\b|\bE401\b|\bE403\b|Unable to authenticate|need auth/i.test(output)) {
    return { kind: 'auth_error', detail: output.trim() }
  }
  if (/\bEAI_AGAIN\b|\bENOTFOUND\b|\bETIMEDOUT\b|\bECONNRESET\b|network/i.test(output)) {
    return { kind: 'network_error', detail: output.trim() }
  }
  return { kind: 'failed', detail: output.trim() }
}

/**
 * Avoid moving `latest` backwards when resuming an older release.
 *
 * @param {{
 *   version: string
 *   distTag: string
 *   currentLatest?: string | null
 * }} options
 */
export function shouldUpdateDistTag(options) {
  if (options.distTag !== 'latest') return true
  if (!options.currentLatest) return true
  return compareSemver(options.version, options.currentLatest) >= 0
}

/**
 * @param {string} a
 * @param {string} b
 */
export function compareSemver(a, b) {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] < pb.core[i] ? -1 : 1
  }
  if (pa.pre === null && pb.pre === null) return 0
  if (pa.pre === null) return 1
  if (pb.pre === null) return -1
  return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0
}

/** @param {string} version */
function parseSemver(version) {
  const [corePart, pre = null] = version.split('-')
  const core = corePart.split('.').map((part) => Number.parseInt(part, 10) || 0)
  while (core.length < 3) core.push(0)
  return { core, pre }
}

/**
 * @param {{
 *   tag: string
 *   commitSha: string
 *   git: (args: string[]) => string
 *   tagExists: (tag: string) => boolean
 *   createTag: (tag: string, sha: string) => void
 *   pushTag: (tag: string) => void
 * }} options
 */
export function ensureGitTag(options) {
  if (!options.tagExists(options.tag)) {
    options.createTag(options.tag, options.commitSha)
    options.pushTag(options.tag)
    return { status: 'created' }
  }
  const pointed = options.git(['rev-list', '-n', '1', options.tag]).trim()
  if (pointed !== options.commitSha) {
    throw new Error(`Tag ${options.tag} already exists at ${pointed}, expected release commit ${options.commitSha}`)
  }
  return { status: 'exists' }
}

/**
 * @param {{
 *   tag: string
 *   title: string
 *   commitSha: string
 *   releaseExists: (tag: string) => boolean
 *   createRelease: (input: { tag: string, title: string, target: string }) => void
 * }} options
 */
export function ensureGithubRelease(options) {
  if (options.releaseExists(options.tag)) return { status: 'exists' }
  options.createRelease({
    tag: options.tag,
    title: options.title,
    target: options.commitSha,
  })
  return { status: 'created' }
}

/**
 * Default git/gh adapters for CI.
 *
 * @param {{ cwd: string, dryRun?: boolean }} options
 */
export function createMetadataAdapters(options) {
  const git = (args) =>
    execFileSync('git', args, { cwd: options.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

  return {
    git,
    tagExists(tag) {
      try {
        git(['rev-parse', '--verify', `refs/tags/${tag}`])
        return true
      } catch {
        return false
      }
    },
    createTag(tag, sha) {
      if (options.dryRun) {
        console.log(`[dry-run] git tag ${tag} ${sha}`)
        return
      }
      execFileSync('git', ['tag', tag, sha], { cwd: options.cwd, stdio: 'inherit' })
    },
    pushTag(tag) {
      if (options.dryRun) {
        console.log(`[dry-run] git push origin ${tag}`)
        return
      }
      if (process.env.SKIP_GIT_PUSH === '1' || process.env.SKIP_GIT_PUSH === 'true') {
        console.log(`SKIP_GIT_PUSH: not pushing tag ${tag}`)
        return
      }
      execFileSync('git', ['push', 'origin', tag], { cwd: options.cwd, stdio: 'inherit' })
    },
    releaseExists(tag) {
      if (options.dryRun || process.env.SKIP_GH_RELEASE === '1' || process.env.SKIP_GH_RELEASE === 'true') {
        return false
      }
      try {
        execFileSync('gh', ['release', 'view', tag], {
          cwd: options.cwd,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return true
      } catch {
        return false
      }
    },
    createRelease({ tag, title, target }) {
      if (options.dryRun) {
        console.log(`[dry-run] gh release create ${tag} --target ${target} --title ${title}`)
        return
      }
      if (process.env.SKIP_GH_RELEASE === '1' || process.env.SKIP_GH_RELEASE === 'true') {
        console.log(`SKIP_GH_RELEASE: not creating GitHub Release for ${tag}`)
        return
      }
      execFileSync('gh', ['release', 'create', tag, '--target', target, '--title', title, '--notes', title], {
        cwd: options.cwd,
        stdio: 'inherit',
      })
    },
  }
}

/**
 * Complete tags/releases for packages confirmed on the registry (published or already present).
 * Do not call this for failed/skipped packages.
 *
 * @param {{
 *   packages: ReadonlyArray<{ name: string, version: string }>
 *   commitSha: string
 *   adapters: ReturnType<typeof createMetadataAdapters>
 * }} options
 */
export function completeReleaseMetadata(options) {
  /** @type {Array<{ tag: string, tagStatus: string, releaseStatus: string }>} */
  const results = []
  for (const pkg of options.packages) {
    const tag = `${pkg.name}@${pkg.version}`
    const tagStatus = ensureGitTag({
      tag,
      commitSha: options.commitSha,
      git: options.adapters.git,
      tagExists: options.adapters.tagExists,
      createTag: options.adapters.createTag,
      pushTag: options.adapters.pushTag,
    }).status
    const releaseStatus = ensureGithubRelease({
      tag,
      title: tag,
      commitSha: options.commitSha,
      releaseExists: options.adapters.releaseExists,
      createRelease: options.adapters.createRelease,
    }).status
    results.push({ tag, tagStatus, releaseStatus })
  }
  return results
}

/**
 * NDJSON events for changesets/action@v2.1.2 (`CHANGESETS_OUTPUT`).
 * Only emit for packages confirmed published / already on the registry.
 *
 * @param {{
 *   outputPath: string
 *   packages: ReadonlyArray<{ name: string, version: string }>
 * }} options
 */
export function writeChangesetsOutput(options) {
  if (!options.outputPath) return
  const lines = options.packages.map((pkg) =>
    JSON.stringify({
      type: 'git-tag',
      tag: `${pkg.name}@${pkg.version}`,
      packageName: pkg.name,
    }),
  )
  if (lines.length === 0) return
  appendFileSync(options.outputPath, `${lines.join('\n')}\n`, 'utf8')
}
