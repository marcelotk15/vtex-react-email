import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import { detectBumpedNames, selectReleaseCohort } from './publish-plan.mjs'
import { isReleaseCommitMessage } from './release-commit.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const changesetsCli = path.join(root, 'node_modules/@changesets/cli/bin.js')
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      try {
        await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
      } catch {
        // best-effort
      }
    }),
  )
})

function git(cwd: string, args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

async function seedRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'vtex-preview-cohort-'))
  tempDirs.push(dir)
  git(dir, ['init'])
  git(dir, ['config', 'user.email', 'test@example.com'])
  git(dir, ['config', 'user.name', 'Test'])
  await writeFile(path.join(dir, 'package.json'), `${JSON.stringify({ name: 'root', private: true }, null, 2)}\n`)
  await writeFile(path.join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  await mkdir(path.join(dir, '.changeset'), { recursive: true })
  await writeFile(
    path.join(dir, '.changeset/config.json'),
    `${JSON.stringify(
      {
        changelog: false,
        commit: false,
        fixed: [],
        linked: [],
        access: 'public',
        baseBranch: 'main',
        updateInternalDependencies: 'patch',
        ignore: [],
      },
      null,
      2,
    )}\n`,
  )

  for (const [dirName, name, deps] of [
    ['core', '@vtex-email/core', {}],
    ['cli', '@vtex-email/cli', { '@vtex-email/core': 'workspace:*' }],
    ['preview', '@vtex-email/preview', { '@vtex-email/cli': 'workspace:*' }],
  ] as const) {
    const pkgDir = path.join(dir, 'packages', dirName)
    await mkdir(pkgDir, { recursive: true })
    await writeFile(
      path.join(pkgDir, 'package.json'),
      `${JSON.stringify({ name, version: '0.1.0', dependencies: deps }, null, 2)}\n`,
    )
  }

  git(dir, ['add', '.'])
  git(dir, ['commit', '-m', 'chore: seed'])
  git(dir, ['branch', '-M', 'main'])
  return dir
}

describe('Preview-only release cohort discovery (squash merge strategy)', { timeout: 120_000 }, () => {
  it('versions Preview only, then detects cohort from HEAD^ without RELEASE_BUMPED_NAMES', async () => {
    const dir = await seedRepo()
    await writeFile(path.join(dir, 'packages/preview/note.txt'), 'preview-only change\n')
    await writeFile(
      path.join(dir, '.changeset/preview-only.md'),
      `---
"@vtex-email/preview": patch
---

Preview-only UI tweak.
`,
    )
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'feat(preview): tweak'])

    execFileSync(process.execPath, [changesetsCli, 'version'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HUSKY: '0' },
    })

    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'chore(release): version packages'])

    expect(isReleaseCommitMessage(git(dir, ['log', '-1', '--pretty=%B']))).toBe(true)

    const parent = 'HEAD^'
    const before = new Map<string, string>()
    for (const dirName of ['core', 'cli', 'preview']) {
      const raw = git(dir, ['show', `${parent}:packages/${dirName}/package.json`])
      const json = JSON.parse(raw) as { name: string; version: string }
      before.set(json.name, json.version)
    }

    const packages = []
    for (const dirName of ['core', 'cli', 'preview']) {
      const packageJson = JSON.parse(await readFile(path.join(dir, 'packages', dirName, 'package.json'), 'utf8')) as {
        name: string
        version: string
        private?: boolean
        dependencies?: Record<string, string>
      }
      packages.push({ dir: path.join(dir, 'packages', dirName), packageJson })
    }

    const bumped = detectBumpedNames(
      before,
      packages.map((pkg) => ({
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
        private: pkg.packageJson.private,
      })),
    )
    const cohort = selectReleaseCohort({ packages, bumpedNames: bumped })
    expect([...bumped]).toEqual(['@vtex-email/preview'])
    expect(cohort.map((item) => item.name)).toEqual(['@vtex-email/preview'])
    expect(cohort[0]?.version).toBe('0.1.1')

    // Orphan: core stayed 0.1.0 and is not selected
    expect(packages.find((pkg) => pkg.packageJson.name === '@vtex-email/core')?.packageJson.version).toBe('0.1.0')

    // Manual version edit without release commit message is not an approved release
    const previewPath = path.join(dir, 'packages/preview/package.json')
    const previewJson = JSON.parse(await readFile(previewPath, 'utf8'))
    previewJson.version = '0.9.9'
    await writeFile(previewPath, `${JSON.stringify(previewJson, null, 2)}\n`)
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'chore: manual version bump'])
    expect(isReleaseCommitMessage(git(dir, ['log', '-1', '--pretty=%B']))).toBe(false)

    // Resume uses fixed release SHA even if main advanced
    const releaseSha = git(dir, ['rev-parse', 'HEAD~1'])
    const advanced = git(dir, ['rev-parse', 'HEAD'])
    expect(advanced).not.toBe(releaseSha)
    const releaseMessage = git(dir, ['log', '-1', '--pretty=%B', releaseSha])
    expect(isReleaseCommitMessage(releaseMessage)).toBe(true)
    const releaseParentVersions = new Map<string, string>()
    for (const dirName of ['core', 'cli', 'preview']) {
      const raw = git(dir, ['show', `${releaseSha}^:packages/${dirName}/package.json`])
      const json = JSON.parse(raw) as { name: string; version: string }
      releaseParentVersions.set(json.name, json.version)
    }
    const releaseAfter = ['core', 'cli', 'preview'].map((dirName) => {
      const json = JSON.parse(git(dir, ['show', `${releaseSha}:packages/${dirName}/package.json`])) as {
        name: string
        version: string
      }
      return json
    })
    const resumed = detectBumpedNames(releaseParentVersions, releaseAfter)
    expect([...resumed]).toEqual(['@vtex-email/preview'])
  })
})
