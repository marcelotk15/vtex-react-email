/**
 * @typedef {{
 *   name: string
 *   version: string
 *   private?: boolean
 *   dependencies?: Record<string, string>
 *   optionalDependencies?: Record<string, string>
 *   peerDependencies?: Record<string, string>
 *   peerDependenciesMeta?: Record<string, { optional?: boolean }>
 * }} PackageJsonLike
 *
 * @typedef {{ dir: string, packageJson: PackageJsonLike }} WorkspacePackage
 *
 * @typedef {{ name: string, version: string, dir: string, distTag: string }} PublishTarget
 *
 * @typedef {{ exitCode: number, stdout: string, stderr: string }} ExecResult
 *
 * @typedef {{ name: string, version: string, dir: string, packageJson: PackageJsonLike }} VersionBump
 */

/**
 * @param {string} packageName
 * @param {ExecResult} result
 * @returns {string[]}
 */
export function parseNpmVersions(packageName, result) {
  if (result.exitCode === 0) {
    const stdout = result.stdout.trim()
    if (stdout.length === 0) return []
    const parsed = JSON.parse(stdout)
    return Array.isArray(parsed) ? parsed : [parsed]
  }

  const output = `${result.stderr}\n${result.stdout}`
  if (/\bE404\b|404 Not Found|is not in (?:this|the npm) registry/i.test(output)) {
    return []
  }

  throw new Error(
    `Failed to read published versions for ${packageName}: ${
      result.stderr.trim() || `npm exited with code ${result.exitCode}`
    }`,
  )
}

/** @param {string} version */
export function selectDistTag(version) {
  const prerelease = version.split('-')[1]?.split('.')[0]
  return prerelease ?? 'latest'
}

/** @param {PackageJsonLike} packageJson */
function runtimeDependenciesOf(packageJson) {
  const peerDependencies = packageJson.peerDependencies ?? {}
  const peerDependenciesMeta = packageJson.peerDependenciesMeta ?? {}
  const requiredPeers = Object.keys(peerDependencies).filter((name) => peerDependenciesMeta[name]?.optional !== true)
  return [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...requiredPeers,
  ]
}

/** @param {WorkspacePackage[]} packages */
export function buildPublishGraph(packages) {
  const inSet = new Set(packages.map((pkg) => pkg.packageJson.name))
  return new Map(
    packages.map((pkg) => [
      pkg.packageJson.name,
      new Set(runtimeDependenciesOf(pkg.packageJson).filter((name) => inSet.has(name))),
    ]),
  )
}

/** @param {Map<string, Set<string>>} graph */
export function topologicalSort(graph) {
  const remaining = new Map([...graph].map(([name, deps]) => [name, new Set(deps)]))
  const ordered = []

  while (remaining.size > 0) {
    const ready = [...remaining].filter(([, deps]) => deps.size === 0).map(([name]) => name)
    if (ready.length === 0) {
      throw new Error(`Cannot publish: dependency cycle between ${[...remaining.keys()].join(', ')}`)
    }
    ready.sort()
    for (const name of ready) {
      ordered.push(name)
      remaining.delete(name)
    }
    for (const deps of remaining.values()) {
      for (const name of ready) deps.delete(name)
    }
  }

  return ordered
}

/**
 * @param {string[]} ordered
 * @param {Map<string, Set<string>>} graph
 * @param {(name: string) => Promise<boolean>} publish
 */
export async function publishInOrder(ordered, graph, publish) {
  const published = []
  const failed = new Set()
  const skipped = []

  for (const name of ordered) {
    const failedDependency = [...(graph.get(name) ?? [])].find((dep) => failed.has(dep))
    if (failedDependency !== undefined) {
      skipped.push(name)
      failed.add(name)
      continue
    }

    if (await publish(name)) published.push(name)
    else failed.add(name)
  }

  return {
    published,
    failed: [...failed].filter((name) => !skipped.includes(name)),
    skipped,
  }
}

/**
 * @param {{ packages: WorkspacePackage[], bumpedNames: ReadonlySet<string> }} options
 * @returns {VersionBump[]}
 */
export function selectReleaseCohort(options) {
  const cohort = []
  for (const pkg of options.packages) {
    if (pkg.packageJson.private === true) continue
    if (!options.bumpedNames.has(pkg.packageJson.name)) continue
    cohort.push({
      name: pkg.packageJson.name,
      version: pkg.packageJson.version,
      dir: pkg.dir,
      packageJson: pkg.packageJson,
    })
  }
  return cohort
}

/**
 * @param {{
 *   cohort: VersionBump[]
 *   getPublishedVersions: (name: string) => Promise<string[]>
 * }} options
 */
export async function planPublish(options) {
  const targets = []
  const alreadyPublished = []

  for (const pkg of options.cohort) {
    const publishedVersions = await options.getPublishedVersions(pkg.name)
    if (publishedVersions.includes(pkg.version)) {
      alreadyPublished.push(`${pkg.name}@${pkg.version}`)
      continue
    }
    targets.push({
      name: pkg.name,
      version: pkg.version,
      dir: pkg.dir,
      distTag: selectDistTag(pkg.version),
    })
  }

  const workspacePkgs = targets.map((target) => {
    const source = options.cohort.find((item) => item.name === target.name)
    return { dir: source.dir, packageJson: source.packageJson }
  })
  const graph = buildPublishGraph(workspacePkgs)
  const byName = new Map(targets.map((target) => [target.name, target]))
  const ordered = topologicalSort(graph).map((name) => byName.get(name))
  return { ordered, graph, alreadyPublished }
}

/**
 * @param {{
 *   ordered: PublishTarget[]
 *   graph: Map<string, Set<string>>
 *   alreadyPublished: string[]
 * }} options
 */
export function formatPublishPlan(options) {
  const lines = []
  if (options.alreadyPublished.length > 0) {
    lines.push('Already published (resume skips):')
    for (const item of options.alreadyPublished) lines.push(`  ${item}`)
  }
  if (options.ordered.length === 0) {
    lines.push('No packages need publishing')
    return lines.join('\n')
  }
  lines.push(`Would publish ${options.ordered.length} package(s) in dependency order:`)
  for (const target of options.ordered) {
    const deps = [...(options.graph.get(target.name) ?? [])]
    const dependsOn = deps.length > 0 ? ` (depends on ${deps.join(', ')})` : ''
    lines.push(`  ${target.name}@${target.version} -> ${target.distTag}${dependsOn}`)
  }
  return lines.join('\n')
}

/**
 * @param {ReadonlyMap<string, string>} before
 * @param {ReadonlyArray<{ name: string, version: string, private?: boolean }>} after
 */
export function detectBumpedNames(before, after) {
  const bumped = new Set()
  for (const pkg of after) {
    if (pkg.private === true) continue
    const previous = before.get(pkg.name)
    if (previous === undefined) continue
    if (previous !== pkg.version) bumped.add(pkg.name)
  }
  return bumped
}
