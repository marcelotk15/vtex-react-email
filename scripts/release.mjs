import { spawn } from 'node:child_process'
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
import { assertApprovedReleaseCommit } from '../tooling/release/release-commit.mjs'
import {
  classifyPublishResult,
  completeReleaseMetadata,
  createMetadataAdapters,
  shouldUpdateDistTag,
} from '../tooling/release/resume-metadata.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_DIRS = ['core', 'vtex', 'react', 'cli', 'preview']

const dryRun =
  process.argv.includes('--dry-run') || process.env.SKIP_NPM_PUBLISH === '1' || process.env.SKIP_NPM_PUBLISH === 'true'

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

function run(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      process.stderr.write(chunk)
    })
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
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

async function main() {
  const commitSha = process.env.RELEASE_COMMIT_SHA || git(['rev-parse', 'HEAD'])
  const commitMessage = process.env.RELEASE_COMMIT_MESSAGE || git(['log', '-1', '--pretty=%B', commitSha])

  const packages = await loadPackages()
  const bumpedNames = await resolveBumpedNames(packages)
  const cohort = selectReleaseCohort({ packages, bumpedNames })

  if (cohort.length === 0) {
    console.log('No release cohort (no version bumps vs parent). Nothing to publish.')
    return
  }

  if (!process.env.RELEASE_BUMPED_NAMES) {
    assertApprovedReleaseCommit({ commitMessage })
  } else {
    console.warn('RELEASE_BUMPED_NAMES override in use; skipping approved-commit check')
  }

  const artifactsDir = process.env.RELEASE_ARTIFACTS_DIR
  /** @type {Map<string, { tarball: string, sha256: string, version: string }> | null} */
  let artifactByName = null
  /** @type {Map<string, Record<string, string>> | undefined} */
  let tarballDependencies

  if (artifactsDir) {
    const verified = await loadAndVerifyManifest({
      manifestPath: path.join(artifactsDir, 'manifest.json'),
      artifactsDir,
      expectedCommit: commitSha,
    })
    artifactByName = new Map()
    tarballDependencies = new Map()
    for (const entry of verified.packages) {
      artifactByName.set(entry.name, entry)
      const pkgJson = await readPackageJsonFromTarball(entry.tarball)
      tarballDependencies.set(entry.name, pkgJson.dependencies ?? {})
    }
    for (const pkg of cohort) {
      if (!artifactByName.has(pkg.name)) {
        throw new Error(`Missing packed artifact for cohort package ${pkg.name}`)
      }
    }
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

  if (dryRun) {
    console.log('Dry run / SKIP_NPM_PUBLISH: not publishing.')
    const adapters = createMetadataAdapters({ cwd: root, dryRun: true })
    completeReleaseMetadata({ cohort, commitSha, adapters })
    return
  }

  const byName = new Map(plan.ordered.map((target) => [target.name, target]))
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
        result = await run('npm', ['publish', artifact.tarball, '--access', 'public', '--tag', distTag], root)
      } else {
        result = await run('pnpm', ['publish', '--no-git-checks', '--access', 'public', '--tag', distTag], target.dir)
      }

      const classified = classifyPublishResult(result)
      if (classified.kind === 'published' || classified.kind === 'already_exists') {
        if (classified.kind === 'already_exists') {
          console.log(`Treating ${target.name}@${target.version} as already published (resume after lost response)`)
        } else {
          console.log(`Published ${target.name}@${target.version}`)
        }
        return true
      }
      console.error(`Failed to publish ${target.name}@${target.version}: ${classified.kind}`)
      if (classified.detail) console.error(classified.detail)
      return false
    },
  )

  console.log(`Published: ${published.join(', ') || '(none)'}`)
  console.log(`Failed: ${failed.join(', ') || '(none)'}`)
  console.log(`Skipped (failed dependency): ${skipped.join(', ') || '(none)'}`)

  // Always attempt metadata for the full cohort (including already-published resume).
  const adapters = createMetadataAdapters({ cwd: root, dryRun: false })
  const metadata = completeReleaseMetadata({ cohort, commitSha, adapters })
  for (const item of metadata) {
    console.log(`Metadata ${item.tag}: tag=${item.tagStatus} release=${item.releaseStatus}`)
  }

  if (failed.length > 0 || skipped.length > 0) process.exitCode = 1
}

await main()
