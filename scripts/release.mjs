import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  detectBumpedNames,
  formatPublishPlan,
  parseNpmVersions,
  planPublish,
  publishInOrder,
  selectReleaseCohort,
} from '../tooling/release/publish-plan.mjs'

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

function run(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('close', (code) => resolve(code ?? 1))
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
  const packages = await loadPackages()
  const bumpedNames = await resolveBumpedNames(packages)
  const cohort = selectReleaseCohort({ packages, bumpedNames })

  if (cohort.length === 0) {
    console.log('No release cohort (no version bumps in release commit). Nothing to publish.')
    return
  }

  const plan = await planPublish({
    cohort,
    getPublishedVersions: async (name) => npmViewVersions(name),
  })
  console.log(formatPublishPlan(plan))

  if (dryRun) {
    console.log('Dry run / SKIP_NPM_PUBLISH: not publishing.')
    return
  }

  if (plan.ordered.length === 0) {
    console.log('Nothing left to publish after resume checks.')
    return
  }

  const buildCode = await run(process.execPath, [path.join(root, 'scripts/build-packages.mjs')], root)
  if (buildCode !== 0) {
    console.error('Build failed; aborting publish.')
    process.exitCode = 1
    return
  }

  const byName = new Map(plan.ordered.map((target) => [target.name, target]))
  const { published, failed, skipped } = await publishInOrder(
    plan.ordered.map((target) => target.name),
    plan.graph,
    async (name) => {
      const target = byName.get(name)
      const code = await run(
        'pnpm',
        ['publish', '--no-git-checks', '--access', 'public', '--tag', target.distTag],
        target.dir,
      )
      if (code === 0) {
        console.log(`Published ${target.name}@${target.version}`)
        return true
      }
      console.error(`Failed to publish ${target.name}@${target.version}`)
      return false
    },
  )

  console.log(`Published: ${published.join(', ') || '(none)'}`)
  console.log(`Failed: ${failed.join(', ') || '(none)'}`)
  console.log(`Skipped (failed dependency): ${skipped.join(', ') || '(none)'}`)

  for (const name of published) {
    const target = byName.get(name)
    const tag = `${target.name}@${target.version}`
    try {
      execFileSync('git', ['tag', tag], { cwd: root, stdio: 'inherit' })
      console.log(`Tagged ${tag}`)
    } catch (error) {
      console.warn(`Could not create tag ${tag}: ${error}`)
    }
  }

  if (failed.length > 0 || skipped.length > 0) process.exitCode = 1
}

await main()
