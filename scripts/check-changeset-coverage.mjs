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
  let diffNames = ''
  try {
    diffNames = git(['diff', '--name-only', `${baseRef}...HEAD`, '--', '.changeset'])
  } catch {
    diffNames = git(['diff', '--name-only', 'HEAD', '--', '.changeset'])
  }
  const files = diffNames
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.md') && !line.toLowerCase().endsWith('readme.md'))

  if (files.length > 0) {
    return Promise.all(files.map(async (file) => readFile(path.join(root, file), 'utf8')))
  }

  const entries = await readdir(path.join(root, '.changeset'))
  const local = entries.filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
  return Promise.all(local.map(async (name) => readFile(path.join(root, '.changeset', name), 'utf8')))
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
