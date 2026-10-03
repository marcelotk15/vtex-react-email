import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  detectBumpedNames,
  formatPublishPlan,
  parseNpmVersions,
  planPublish,
  selectReleaseCohort,
} from '../tooling/release/publish-plan.mjs'
import { isReleaseCommitMessage } from '../tooling/release/release-commit.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_DIRS = ['core', 'vtex', 'react', 'cli', 'preview']

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

async function resolveBumpedNames(packages) {
  if (process.env.RELEASE_BUMPED_NAMES) {
    return new Set(
      process.env.RELEASE_BUMPED_NAMES.split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
  }

  const commitSha = process.env.RELEASE_COMMIT_SHA || 'HEAD'
  const commitMessage = process.env.RELEASE_COMMIT_MESSAGE || git(['log', '-1', '--pretty=%B', commitSha])
  if (!isReleaseCommitMessage(commitMessage)) {
    console.log(
      'HEAD is not an approved release commit (chore(release): version packages). Cohort is empty unless RELEASE_BUMPED_NAMES is set.',
    )
    return new Set()
  }

  const parent = process.env.RELEASE_PARENT_REF ?? `${commitSha}^`
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
  const packages = await loadPackages()
  const bumpedNames = await resolveBumpedNames(packages)
  const cohort = selectReleaseCohort({ packages, bumpedNames })
  const plan = await planPublish({
    cohort,
    getPublishedVersions: async (name) => npmViewVersions(name),
  })
  console.log(formatPublishPlan(plan))
  if (process.env.RELEASE_PLAN_JSON) {
    console.log(
      JSON.stringify(
        {
          ordered: plan.ordered,
          alreadyPublished: plan.alreadyPublished,
          bumped: [...bumpedNames],
        },
        null,
        2,
      ),
    )
  }
}

await main()
