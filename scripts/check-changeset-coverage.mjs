import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkChangesetCoverage, isReleasePrContext } from '../tooling/release/changeset-coverage.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.silent ? ['ignore', 'pipe', 'pipe'] : undefined,
  }).trim()
}

function resolveBaseRef() {
  if (process.env.CHANGESET_BASE_REF) return process.env.CHANGESET_BASE_REF
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`
  for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    try {
      git(['rev-parse', '--verify', candidate], { silent: true })
      return candidate
    } catch {
      // try next
    }
  }
  return 'HEAD~1'
}

async function readNewChangesetContents(baseRef) {
  // Union commit-range changesets with every local .changeset/*.md so untracked
  // files still count before they are committed (CI already has them in HEAD).
  const names = new Set()
  let diffNames = ''
  try {
    diffNames = git(['diff', '--name-only', `${baseRef}...HEAD`, '--', '.changeset'])
  } catch {
    try {
      diffNames = git(['diff', '--name-only', 'HEAD', '--', '.changeset'])
    } catch {
      diffNames = ''
    }
  }
  for (const line of diffNames.split(/\r?\n/)) {
    const trimmed = line.trim().replaceAll('\\', '/')
    if (!trimmed.endsWith('.md') || trimmed.toLowerCase().endsWith('readme.md')) continue
    names.add(path.basename(trimmed))
  }

  const entries = await readdir(path.join(root, '.changeset'))
  for (const name of entries) {
    if (name.endsWith('.md') && name.toLowerCase() !== 'readme.md') names.add(name)
  }

  return Promise.all([...names].sort().map(async (name) => readFile(path.join(root, '.changeset', name), 'utf8')))
}

async function main() {
  const baseRef = resolveBaseRef()
  let changedFiles = []
  try {
    changedFiles = git(['diff', '--name-only', `${baseRef}...HEAD`])
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch (error) {
    console.error(`Unable to diff against ${baseRef}: ${error}`)
    process.exitCode = 1
    return
  }

  if (
    isReleasePrContext({
      prTitle: process.env.PR_TITLE,
      headRef: process.env.PR_HEAD_REF,
      changedFiles,
    })
  ) {
    console.log('Skipping changeset coverage on structural Version Packages PR')
    return
  }

  const changesetContents = await readNewChangesetContents(baseRef)
  const result = checkChangesetCoverage({ changedFiles, changesetContents })
  console.log(result.reason)
  if (!result.ok) process.exitCode = 1
}

await main()
