import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function commitlintFile(filePath) {
  const result = spawnSync('pnpm', ['exec', 'commitlint', '--edit', filePath], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  return result.status ?? 1
}

async function lintMessage(message, label) {
  const dir = await mkdtemp(path.join(tmpdir(), 'commitlint-'))
  const file = path.join(dir, 'message.txt')
  try {
    await writeFile(file, `${message.trim()}\n`, 'utf8')
    const code = commitlintFile(file)
    if (code !== 0) {
      console.error(`commitlint failed for ${label}`)
      return code
    }
    console.log(`OK: ${label}`)
    return 0
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function main() {
  const base = process.env.COMMITLINT_BASE ?? process.env.GITHUB_BASE_REF
  const head = process.env.COMMITLINT_HEAD ?? 'HEAD'
  if (!base) {
    console.error('COMMITLINT_BASE or GITHUB_BASE_REF is required')
    process.exitCode = 1
    return
  }

  const baseRef = base.includes('/') ? base : `origin/${base}`
  let range
  try {
    const mergeBase = git(['merge-base', baseRef, head])
    range = `${mergeBase}..${head}`
  } catch {
    range = `${baseRef}..${head}`
  }

  const log = git(['log', '--format=%H%n%s%n%b%n---COMMIT---', range])
  const chunks = log
    .split('---COMMIT---')
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  let failed = false
  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/)
    const sha = lines[0]
    const subject = lines[1] ?? ''
    // Skip merge commits: conventional config typically allows them via ignores or we skip.
    if (/^Merge\b/i.test(subject)) {
      console.log(`Skipping merge commit ${sha}`)
      continue
    }
    const message = lines.slice(1).join('\n').trim()
    if (!message) continue
    const code = await lintMessage(message, `commit ${sha.slice(0, 7)}`)
    if (code !== 0) failed = true
  }

  const prTitle = process.env.PR_TITLE
  if (prTitle && prTitle.trim()) {
    const code = await lintMessage(prTitle, 'pull request title')
    if (code !== 0) failed = true
  }

  if (failed) process.exitCode = 1
}

await main()
