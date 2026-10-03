import { satisfiesRange } from './semver-lite.mjs'

/**
 * @param {string} range
 */
export function normalizePublishedRange(range) {
  if (range.startsWith('workspace:')) {
    const inner = range.slice('workspace:'.length)
    if (inner === '*' || inner === '^' || inner === '~') return '*'
    return inner
  }
  return range
}

/**
 * Ensure every internal runtime dependency required by the publish cohort
 * is already available on the registry (or in the same cohort being published).
 *
 * @param {{
 *   cohort: ReadonlyArray<{ name: string, version: string, packageJson: {
 *     name: string
 *     dependencies?: Record<string, string>
 *     optionalDependencies?: Record<string, string>
 *     peerDependencies?: Record<string, string>
 *     peerDependenciesMeta?: Record<string, { optional?: boolean }>
 *   } }>
 *   workspaceNames: ReadonlySet<string>
 *   getPublishedVersions: (name: string) => Promise<string[]>
 *   tarballDependencies?: ReadonlyMap<string, Record<string, string>>
 * }} options
 */
export async function assertInternalDependenciesAvailable(options) {
  const cohortNames = new Set(options.cohort.map((item) => item.name))
  const cohortVersions = new Map(options.cohort.map((item) => [item.name, item.version]))
  /** @type {string[]} */
  const problems = []

  for (const pkg of options.cohort) {
    const deps = options.tarballDependencies?.get(pkg.name) ?? pkg.packageJson.dependencies ?? {}
    const optional = new Set(Object.keys(pkg.packageJson.optionalDependencies ?? {}))
    const peerMeta = pkg.packageJson.peerDependenciesMeta ?? {}
    const peers = Object.entries(pkg.packageJson.peerDependencies ?? {}).filter(
      ([name]) => peerMeta[name]?.optional !== true,
    )

    const required = [...Object.entries(deps).filter(([name]) => !optional.has(name)), ...peers]

    for (const [depName, range] of required) {
      if (!options.workspaceNames.has(depName)) continue
      const normalized = normalizePublishedRange(range)
      if (cohortNames.has(depName)) {
        const version = cohortVersions.get(depName)
        if (version && (normalized === '*' || satisfiesRange(version, normalized))) continue
        problems.push(`${pkg.name}@${pkg.version} depends on ${depName}@${range} but cohort has ${depName}@${version}`)
        continue
      }
      const published = await options.getPublishedVersions(depName)
      const ok = published.some((version) => normalized === '*' || satisfiesRange(version, normalized))
      if (!ok) {
        problems.push(
          `${pkg.name}@${pkg.version} requires ${depName}@${range}, but no compatible version is published (and it is not in this release cohort)`,
        )
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Internal dependency gate failed:\n- ${problems.join('\n- ')}`)
  }
}
