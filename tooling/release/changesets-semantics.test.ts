import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const changesetsCli = path.join(root, 'node_modules/@changesets/cli/bin.js')

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      try {
        await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
      } catch {
        // Windows may keep handles briefly; temp cleanup is best-effort.
      }
    }),
  )
})

async function makeWorkspace(layout: {
  packages: Array<{
    dir: string
    name: string
    version: string
    dependencies?: Record<string, string>
  }>
}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vtex-cs-sem-'))
  tempDirs.push(dir)
  await writeFile(
    path.join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'cs-sem-root',
        private: true,
        packageManager: 'pnpm@12.8.1',
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(path.join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  await mkdir(path.join(dir, '.changeset'), { recursive: true })
  await writeFile(
    path.join(dir, '.changeset/config.json'),
    `${JSON.stringify(
      {
        $schema: 'https://unpkg.com/@changesets/config@3.0.0/schema.json',
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
  await mkdir(path.join(dir, 'packages'), { recursive: true })
  for (const pkg of layout.packages) {
    const pkgDir = path.join(dir, 'packages', pkg.dir)
    await mkdir(pkgDir, { recursive: true })
    await writeFile(
      path.join(pkgDir, 'package.json'),
      `${JSON.stringify(
        {
          name: pkg.name,
          version: pkg.version,
          dependencies: pkg.dependencies ?? {},
        },
        null,
        2,
      )}\n`,
    )
  }
  return dir
}

function runChangesetVersion(cwd: string) {
  execFileSync(process.execPath, [changesetsCli, 'version'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HUSKY: '0' },
  })
}

async function addChangeset(cwd: string, id: string, frontmatter: string, body: string) {
  await writeFile(path.join(cwd, '.changeset', `${id}.md`), `---\n${frontmatter}\n---\n\n${body}\n`)
}

async function readPkg(cwd: string, dirName: string) {
  return JSON.parse(await readFile(path.join(cwd, 'packages', dirName, 'package.json'), 'utf8')) as {
    name: string
    version: string
    dependencies?: Record<string, string>
  }
}

describe('Changesets 3.0.3 updateInternalDependencies / dependents semantics', { timeout: 60_000 }, () => {
  it('does not bump a dependent when a patch stays inside a classic semver range', async () => {
    const cwd = await makeWorkspace({
      packages: [
        { dir: 'a', name: 'pkg-a', version: '1.0.0' },
        { dir: 'b', name: 'pkg-b', version: '1.0.0', dependencies: { 'pkg-a': '^1.0.0' } },
      ],
    })
    await addChangeset(cwd, 'a-patch', '"pkg-a": patch', 'Patch A inside range.')
    runChangesetVersion(cwd)
    const a = await readPkg(cwd, 'a')
    const b = await readPkg(cwd, 'b')
    expect(a.version).toBe('1.0.1')
    expect(b.version).toBe('1.0.0')
    expect(b.dependencies?.['pkg-a']).toBe('^1.0.0')
  })

  it('adds a dependent patch when the dependency leaves the classic range', async () => {
    const cwd = await makeWorkspace({
      packages: [
        { dir: 'a', name: 'pkg-a', version: '1.0.0' },
        { dir: 'b', name: 'pkg-b', version: '1.0.0', dependencies: { 'pkg-a': '~1.0.0' } },
      ],
    })
    await addChangeset(cwd, 'a-minor', '"pkg-a": minor', 'Minor A leaves tilde range.')
    runChangesetVersion(cwd)
    const a = await readPkg(cwd, 'a')
    const b = await readPkg(cwd, 'b')
    expect(a.version).toBe('1.1.0')
    expect(b.version).toBe('1.0.1')
    expect(b.dependencies?.['pkg-a']).toBe('~1.1.0')
  })

  it('keeps an explicit dependent changeset bump when the dependency also releases', async () => {
    const cwd = await makeWorkspace({
      packages: [
        { dir: 'a', name: 'pkg-a', version: '1.0.0' },
        { dir: 'b', name: 'pkg-b', version: '1.0.0', dependencies: { 'pkg-a': '^1.0.0' } },
      ],
    })
    await addChangeset(cwd, 'both', '"pkg-a": patch\n"pkg-b": minor', 'Both declared.')
    runChangesetVersion(cwd)
    const a = await readPkg(cwd, 'a')
    const b = await readPkg(cwd, 'b')
    expect(a.version).toBe('1.0.1')
    expect(b.version).toBe('1.1.0')
    expect(b.dependencies?.['pkg-a']).toBe('^1.0.1')
  })

  it('with workspace:* like this monorepo, a dependency bump out-of-range patches the dependent and keeps workspace:*', async () => {
    const cwd = await makeWorkspace({
      packages: [
        { dir: 'cli', name: '@vtex-email/cli', version: '0.1.0' },
        {
          dir: 'preview',
          name: '@vtex-email/preview',
          version: '0.1.0',
          dependencies: { '@vtex-email/cli': 'workspace:*' },
        },
      ],
    })
    await addChangeset(cwd, 'cli-patch', '"@vtex-email/cli": patch', 'CLI patch only.')
    runChangesetVersion(cwd)
    const cli = await readPkg(cwd, 'cli')
    const preview = await readPkg(cwd, 'preview')
    expect(cli.version).toBe('0.1.1')
    // workspace:* is treated as exact oldVersion for out-of-range → dependent is patched
    expect(preview.version).toBe('0.1.1')
    expect(preview.dependencies?.['@vtex-email/cli']).toBe('workspace:*')
  })
})
