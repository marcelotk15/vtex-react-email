import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertInternalDependenciesAvailable } from '../tooling/release/internal-deps-gate.mjs'
import { loadAndVerifyManifest, readPackageJsonFromTarball } from '../tooling/release/pack-artifacts.mjs'
import {
  detectBumpedNames,
  formatPublishPlan,
  parseNpmVersions,
  planPublish,
  publishInOrder,
  selectReleaseCohort,
} from '../tooling/release/publish-plan.mjs'
import {
  assertArtifactsMatchCohort,
  assertCommitOnMain,
  assertFullSha,
  loadHistoricalCohort,
  parseAlreadyPublished,
} from '../tooling/release/recover-release.mjs'
import { assertApprovedReleaseCommit } from '../tooling/release/release-commit.mjs'
import {
  classifyPublishResult,
  completeReleaseMetadata,
  createMetadataAdapters,
  shouldUpdateDistTag,
  writeChangesetsOutput,
} from '../tooling/release/resume-metadata.mjs'
import { runProcess } from '../tooling/release/run-process.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_DIRS = ['core', 'vtex', 'react', 'cli', 'preview']

const dryRun =
  process.argv.includes('--dry-run') || process.env.SKIP_NPM_PUBLISH === '1' || process.env.SKIP_NPM_PUBLISH === 'true'

const recoveryMode = process.env.RELEASE_RECOVERY === '1' || process.env.RELEASE_RECOVERY === 'true'

function gitShow(ref, file) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8' })
  } catch {
    return null
  }
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

async function loadPackages() {
  const packages = []
  for (const dirName of PACKAGE_DIRS) {
    const dir = path.join(root, 'packages', dirName)
    const packageJson = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'))
    packages.push({ dir, packageJson })
  }
  return packages
}

function npmViewVersions(packageName) {
  try {
    const stdout = execFileSync('npm', ['view', packageName, 'versions', '--json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return parseNpmVersions(packageName, { exitCode: 0, stdout, stderr: '' })
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? ''
    const stderr = error.stderr?.toString?.() ?? error.message
    const exitCode = typeof error.status === 'number' ? error.status : 1
    return parseNpmVersions(packageName, { exitCode, stdout, stderr })
  }
}

function npmViewDistTag(packageName, tag) {
  try {
    return execFileSync('npm', ['view', packageName, `dist-tags.${tag}`, '--json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .trim()
      .replace(/^"|"$/g, '')
  } catch {
    return null
  }
}

async function resolveBumpedNames(packages) {
  if (process.env.RELEASE_BUMPED_NAMES) {
    return new Set(
      process.env.RELEASE_BUMPED_NAMES.split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
  }

  const parent = process.env.RELEASE_PARENT_REF ?? 'HEAD^'
  const before = new Map()
  for (const dirName of PACKAGE_DIRS) {
    const raw = gitShow(parent, `packages/${dirName}/package.json`)
    if (!raw) continue
    const json = JSON.parse(raw)
    before.set(json.name, json.version)
  }
  const after = packages.map((pkg) => ({
    name: pkg.packageJson.name,
    version: pkg.packageJson.version,
    private: pkg.packageJson.private,
  }))
  if (before.size === 0) return new Set()
  return detectBumpedNames(before, after)
}

/**
 * @param {ReadonlyArray<{ name: string, version: string }>} packages
 * @param {string} commitSha
 * @param {boolean} isDryRun
 */
function finishMetadata(packages, commitSha, isDryRun) {
  if (packages.length === 0) {
    console.log('No confirmed packages for release metadata.')
    return
  }
  if (isDryRun) {
    console.log('Dry run: not creating tags/releases. Would complete metadata for:')
    for (const pkg of packages) console.log(`  ${pkg.name}@${pkg.version}`)
    return
  }
  const adapters = createMetadataAdapters({ cwd: root, dryRun: false })
  const metadata = completeReleaseMetadata({ packages, commitSha, adapters })
  for (const item of metadata) {
    console.log(`Metadata ${item.tag}: tag=${item.tagStatus} release=${item.releaseStatus}`)
  }
  if (process.env.CHANGESETS_OUTPUT) {
    writeChangesetsOutput({ outputPath: process.env.CHANGESETS_OUTPUT, packages })
  }
}

/**
 * @param {{
 *   name: string
 *   version: string
 *   classified: { kind: string, detail?: string }
 * }} options
 */
async function confirmConflictOnRegistry(options) {
  const versions = npmViewVersions(options.name)
  if (!versions.includes(options.version)) {
    console.error(`Publish conflict for ${options.name}@${options.version} but version is not present on the registry`)
    if (options.classified.detail) console.error(options.classified.detail)
    return false
  }
  console.log(`Confirmed ${options.name}@${options.version} already on registry after publish conflict`)
  return true
}

async function resolveNormalContext() {
  const commitSha = process.env.RELEASE_COMMIT_SHA || git(['rev-parse', 'HEAD'])
  const commitMessage = process.env.RELEASE_COMMIT_MESSAGE || git(['log', '-1', '--pretty=%B', commitSha])
  const packages = await loadPackages()
  const bumpedNames = await resolveBumpedNames(packages)
  const cohort = selectReleaseCohort({ packages, bumpedNames })

  if (cohort.length === 0) {
    return { kind: 'empty' }
  }

  if (!process.env.RELEASE_BUMPED_NAMES) {
    assertApprovedReleaseCommit({ commitMessage })
  } else {
    console.warn('RELEASE_BUMPED_NAMES override in use; skipping approved-commit check')
  }

  return {
    kind: 'normal',
    releaseSha: commitSha,
    executionSha: process.env.GITHUB_SHA || commitSha,
    packages,
    cohort,
    artifactsRequired: Boolean(process.env.RELEASE_ARTIFACTS_DIR),
  }
}

async function resolveRecoveryContext() {
  if (process.env.RELEASE_BUMPED_NAMES) {
    console.warn('RELEASE_BUMPED_NAMES is ignored in recovery mode; historical cohort validation is required')
  }

  const releaseSha = assertFullSha(process.env.RELEASE_SHA)
  const executionSha = process.env.GITHUB_SHA || git(['rev-parse', 'HEAD'])

  assertCommitOnMain({
    releaseSha,
    revParse: (ref) => git(['rev-parse', ref]),
    isAncestor: (ancestor, descendant) => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
          cwd: root,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return true
      } catch {
        return false
      }
    },
  })

  const commitMessage = git(['log', '-1', '--pretty=%B', releaseSha])
  const historical = loadHistoricalCohort({
    releaseSha,
    packageDirs: PACKAGE_DIRS,
    gitShow,
    commitMessage,
  })

  console.log(`[recovery] execution_sha=${executionSha}`)
  console.log(`[recovery] release_sha=${releaseSha} (artifacts + cohort source)`)
  console.log(`[recovery] provenance: npm OIDC binds to execution_sha; artifacts were built at release_sha`)

  if (historical.cohort.length === 0) {
    return { kind: 'empty' }
  }

  if (!process.env.RELEASE_ARTIFACTS_DIR) {
    throw new Error('Recovery requires RELEASE_ARTIFACTS_DIR with the original packed tarballs')
  }

  return {
    kind: 'recovery',
    releaseSha,
    executionSha,
    packages: historical.packages,
    cohort: historical.cohort,
    artifactsRequired: true,
  }
}

async function main() {
  const context = recoveryMode ? await resolveRecoveryContext() : await resolveNormalContext()
  if (context.kind === 'empty') {
    console.log('No release cohort (no version bumps vs parent). Nothing to publish.')
    return
  }

  const { releaseSha, packages, cohort, artifactsRequired } = context
  const artifactsDir = process.env.RELEASE_ARTIFACTS_DIR

  /** @type {Map<string, { tarball: string, sha256: string, version: string, name: string }> | null} */
  let artifactByName = null
  /** @type {Map<string, Record<string, string>> | undefined} */
  let tarballDependencies

  if (artifactsRequired && !artifactsDir) {
    throw new Error('RELEASE_ARTIFACTS_DIR is required for this publish path')
  }

  if (artifactsDir) {
    const verified = await loadAndVerifyManifest({
      manifestPath: path.join(artifactsDir, 'manifest.json'),
      artifactsDir,
      expectedCommit: releaseSha,
      verifyTarballPackageJson: true,
    })
    artifactByName = new Map()
    tarballDependencies = new Map()
    for (const entry of verified.packages) {
      artifactByName.set(entry.name, entry)
      const pkgJson = await readPackageJsonFromTarball(entry.tarball)
      tarballDependencies.set(entry.name, pkgJson.dependencies ?? {})
    }
    assertArtifactsMatchCohort({ cohort, artifacts: verified.packages })
  } else if (recoveryMode) {
    throw new Error('Recovery refuses to publish from workspace folders; original artifacts are required')
  }

  const workspaceNames = new Set(packages.map((pkg) => pkg.packageJson.name))
  await assertInternalDependenciesAvailable({
    cohort,
    workspaceNames,
    getPublishedVersions: async (name) => npmViewVersions(name),
    tarballDependencies,
  })

  const plan = await planPublish({
    cohort,
    getPublishedVersions: async (name) => npmViewVersions(name),
  })
  console.log(formatPublishPlan(plan))

  const alreadyConfirmed = parseAlreadyPublished(plan.alreadyPublished)

  if (dryRun) {
    console.log('Dry run / SKIP_NPM_PUBLISH: validating plan and artifacts only; not publishing.')
    const wouldConfirm = [
      ...alreadyConfirmed,
      ...plan.ordered.map((target) => ({ name: target.name, version: target.version })),
    ]
    finishMetadata(wouldConfirm, releaseSha, true)
    return
  }

  const byName = new Map(plan.ordered.map((target) => [target.name, target]))
  /** @type {Array<{ name: string, version: string }>} */
  const newlyConfirmed = []

  const { published, failed, skipped } = await publishInOrder(
    plan.ordered.map((target) => target.name),
    plan.graph,
    async (name) => {
      const target = byName.get(name)
      const currentLatest = npmViewDistTag(name, 'latest')
      const distTag = shouldUpdateDistTag({
        version: target.version,
        distTag: target.distTag,
        currentLatest,
      })
        ? target.distTag
        : `release-${target.version.replace(/[^\w.-]+/g, '-')}`

      if (distTag !== target.distTag) {
        console.warn(
          `Refusing to move latest backwards for ${name}@${target.version} (latest=${currentLatest}); using tag ${distTag}`,
        )
      }

      let result
      if (artifactByName) {
        const artifact = artifactByName.get(name)
        if (!artifact) {
          console.error(`Missing artifact for ${name}`)
          return false
        }
        result = await runProcess('npm', ['publish', artifact.tarball, '--access', 'public', '--tag', distTag], {
          cwd: root,
          inheritStdio: true,
        })
      } else {
        result = await runProcess('pnpm', ['publish', '--no-git-checks', '--access', 'public', '--tag', distTag], {
          cwd: target.dir,
          inheritStdio: true,
        })
      }

      const classified = classifyPublishResult(result)
      if (classified.kind === 'published') {
        console.log(`Published ${target.name}@${target.version}`)
        newlyConfirmed.push({ name: target.name, version: target.version })
        return true
      }
      if (classified.kind === 'already_exists') {
        const ok = await confirmConflictOnRegistry({
          name: target.name,
          version: target.version,
          classified,
        })
        if (ok) newlyConfirmed.push({ name: target.name, version: target.version })
        return ok
      }
      console.error(`Failed to publish ${target.name}@${target.version}: ${classified.kind}`)
      if (classified.detail) console.error(classified.detail)
      return false
    },
  )

  console.log(`Published: ${published.join(', ') || '(none)'}`)
  console.log(`Failed: ${failed.join(', ') || '(none)'}`)
  console.log(`Skipped (failed dependency): ${skipped.join(', ') || '(none)'}`)

  const confirmed = [...alreadyConfirmed, ...newlyConfirmed]
  finishMetadata(confirmed, releaseSha, false)

  if (failed.length > 0 || skipped.length > 0) process.exitCode = 1
}

await main()
