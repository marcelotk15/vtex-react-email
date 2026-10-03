export const PUBLISHABLE_DIR_TO_NAME = {
  core: '@vtex-email/core',
  vtex: '@vtex-email/vtex',
  react: '@vtex-email/react',
  cli: '@vtex-email/cli',
  preview: '@vtex-email/preview',
}

/** @param {string} content */
export function parseChangesetMarkdown(content) {
  const trimmed = content.replace(/^\uFEFF/, '')
  if (!trimmed.startsWith('---')) {
    return { empty: false, packages: {} }
  }
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return { empty: false, packages: {} }
  const frontmatter = trimmed.slice(3, end).trim()
  if (frontmatter.length === 0) {
    return { empty: true, packages: {} }
  }

  /** @type {Record<string, 'patch' | 'minor' | 'major'>} */
  const packages = {}
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = /^\s*"?(@?[^":\s]+)"?\s*:\s*(patch|minor|major)\s*$/.exec(line)
    if (match) packages[match[1]] = /** @type {'patch' | 'minor' | 'major'} */ (match[2])
  }
  return { empty: Object.keys(packages).length === 0, packages }
}

/** @param {readonly string[]} files */
export function packagesFromChangedFiles(files) {
  const affected = new Set()
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/')
    const match = /(?:^|\/)packages\/([^/]+)\//.exec(normalized)
    if (!match) continue
    const name = PUBLISHABLE_DIR_TO_NAME[match[1]]
    if (name) affected.add(name)
  }
  return affected
}

/**
 * @param {{
 *   changedFiles: readonly string[]
 *   changesetContents: readonly string[]
 *   isReleasePr?: boolean
 * }} options
 */
export function checkChangesetCoverage(options) {
  if (options.isReleasePr) {
    return { ok: true, reason: 'Skipped coverage on Version Packages PR' }
  }

  const touched = packagesFromChangedFiles(options.changedFiles)
  if (touched.size === 0) {
    return { ok: true, reason: 'No publishable package paths changed' }
  }

  const parsed = options.changesetContents.map(parseChangesetMarkdown)
  if (parsed.some((item) => item.empty)) {
    return { ok: true, reason: 'Empty changeset records intentional no-release' }
  }

  const covered = new Set()
  for (const item of parsed) {
    for (const name of Object.keys(item.packages)) covered.add(name)
  }

  const missing = [...touched].filter((name) => !covered.has(name)).sort()
  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      reason: `Publishable packages changed without a covering changeset: ${missing.join(', ')}`,
    }
  }

  return { ok: true, reason: 'All touched publishable packages are covered by changesets' }
}

/** @param {{ prTitle?: string, headRef?: string }} options */
export function isReleasePrContext(options) {
  const title = options.prTitle?.trim() ?? ''
  if (/^chore\(release\):/i.test(title)) return true
  const head = options.headRef ?? ''
  if (/changeset-release\//i.test(head)) return true
  return false
}
