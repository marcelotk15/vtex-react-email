import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile, rm, readFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const commitlintCli = path.join(root, 'node_modules/@commitlint/cli/cli.js')
const temps: string[] = []

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix))
  temps.push(dir)
  return dir
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    windowsHide: true,
  })
}

async function commitlintMessage(message: string) {
  const dir = await tempDir('commitlint-msg-')
  const file = path.join(dir, 'COMMIT_EDITMSG')
  await writeFile(file, `${message}\n`, 'utf8')
  return run(process.execPath, [commitlintCli, '--edit', file], root)
}

describe('commitlint config', { timeout: 60_000 }, () => {
  it('accepts conventional messages', async () => {
    for (const message of [
      'feat(preview): add system theme support',
      'fix(core): preserve parent context in nested loops',
      'ci: configure selective package publishing',
      'chore(release): version packages',
      'feat(cli)!: rename project export',
      'docs: atualizar guia de contribuição',
    ]) {
      const result = await commitlintMessage(message)
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    }
  })

  it('rejects invalid messages with diagnostics', async () => {
    const result = await commitlintMessage('updated stuff')
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/type|subject|conventional/i)
  })

  it('allows optional scope and breaking change footer', async () => {
    const result = await commitlintMessage('feat: allow missing scope\n\nBREAKING CHANGE: public API renamed.\n')
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })
})

describe('prepare-husky', () => {
  it('skips when HUSKY=0', () => {
    const result = run(process.execPath, [path.join(root, 'scripts/prepare-husky.mjs')], root, {
      HUSKY: '0',
    })
    expect(result.status).toBe(0)
    expect(result.stdout + result.stderr).toMatch(/HUSKY disabled/i)
  })

  it('skips without .git', async () => {
    const dir = await tempDir('no-git-')
    await writeFile(path.join(dir, 'package.json'), '{"private":true}\n')
    const result = run(process.execPath, [path.join(root, 'scripts/prepare-husky.mjs')], dir, {
      HUSKY: '1',
    })
    expect(result.status).toBe(0)
    expect(result.stdout + result.stderr).toMatch(/no \.git/i)
  })
})

describe('commit-msg hook contract in temporary repo', () => {
  it('rejects invalid and accepts conventional messages; keeps spaced paths intact', async () => {
    const dir = await tempDir('husky-repo-')
    expect(run('git', ['init'], dir).status).toBe(0)
    run('git', ['config', 'user.email', 'test@example.com'], dir)
    run('git', ['config', 'user.name', 'Test'], dir)

    const hooks = path.join(dir, '.husky')
    await mkdir(hooks, { recursive: true })
    const nodePath = process.execPath.replaceAll('\\', '/')
    const cliPath = commitlintCli.replaceAll('\\', '/')
    const configPath = path.join(root, 'commitlint.config.mjs').replaceAll('\\', '/')
    const hookPath = path.join(hooks, 'commit-msg')
    await writeFile(hookPath, `#!/bin/sh\n"${nodePath}" "${cliPath}" --config "${configPath}" --edit "$1"\n`, 'utf8')
    try {
      await chmod(hookPath, 0o755)
    } catch {
      // Windows may ignore chmod
    }
    run('git', ['config', 'core.hooksPath', '.husky'], dir)

    const spaced = path.join(dir, 'docs', 'with space')
    await mkdir(spaced, { recursive: true })
    await writeFile(path.join(spaced, 'note.md'), '# note\n', 'utf8')

    const bad = run('git', ['commit', '--allow-empty', '-m', 'bad message'], dir)
    expect(bad.status).not.toBe(0)

    const good = run('git', ['commit', '--allow-empty', '-m', 'chore: temp repo commitlint check'], dir)
    expect(good.status, `${good.stdout}\n${good.stderr}`).toBe(0)

    const listing = await readFile(path.join(spaced, 'note.md'), 'utf8')
    expect(listing).toContain('note')
  })
})

describe('repo husky hook files', () => {
  it('uses quoted commitlint --edit "$1" and lint-staged', async () => {
    const commitMsg = await readFile(path.join(root, '.husky/commit-msg'), 'utf8')
    const preCommit = await readFile(path.join(root, '.husky/pre-commit'), 'utf8')
    expect(commitMsg).toContain('commitlint --edit "$1"')
    expect(preCommit).toContain('lint-staged')
  })
})
