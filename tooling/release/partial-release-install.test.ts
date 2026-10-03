import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { packPublishablePackages, readPackageJsonFromTarball } from './pack-artifacts.mjs'

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

function run(command: string, args: string[], cwd: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HUSKY: '0' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

describe('partial release install simulation', { timeout: 180_000 }, () => {
  it('installs a new Preview tarball against older pinned CLI/core file tarballs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-partial-'))
    tempDirs.push(root)
    await writeFile(
      path.join(root, 'package.json'),
      `${JSON.stringify({ name: 'root', private: true, packageManager: 'pnpm@12.8.1' }, null, 2)}\n`,
    )
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')

    const specs = [
      ['core', '@vtex-email/core', '0.1.0', {}],
      ['cli', '@vtex-email/cli', '0.1.0', { '@vtex-email/core': 'workspace:*' }],
      ['preview', '@vtex-email/preview', '0.2.0', { '@vtex-email/cli': 'workspace:*' }],
    ] as const

    for (const [dirName, name, version, deps] of specs) {
      const pkgDir = path.join(root, 'packages', dirName)
      await mkdir(path.join(pkgDir, 'dist'), { recursive: true })
      await writeFile(path.join(pkgDir, 'dist', 'index.js'), `export const name = '${name}'\n`)
      await writeFile(
        path.join(pkgDir, 'package.json'),
        `${JSON.stringify({ name, version, files: ['dist'], dependencies: deps }, null, 2)}\n`,
      )
    }

    const install = await run('pnpm', ['install'], root)
    expect(install.code).toBe(0)

    const outDir = path.join(root, 'out')
    const { artifacts } = await packPublishablePackages({
      root,
      outDir,
      packageDirs: ['core', 'cli', 'preview'],
    })

    const previewPkg = await readPackageJsonFromTarball(
      artifacts.find((item) => item.name === '@vtex-email/preview')!.tarball,
    )
    expect(previewPkg.dependencies?.['@vtex-email/cli']).toBe('0.1.0')

    const consumer = path.join(root, 'consumer')
    await mkdir(consumer, { recursive: true })
    const byName = Object.fromEntries(artifacts.map((item) => [item.name, item.tarball]))
    const fileUrl = (name: string) => `file:${byName[name].replaceAll('\\', '/')}`
    await writeFile(
      path.join(consumer, 'pnpm-workspace.yaml'),
      [
        'overrides:',
        `  "@vtex-email/core": "${fileUrl('@vtex-email/core')}"`,
        `  "@vtex-email/cli": "${fileUrl('@vtex-email/cli')}"`,
        `  "@vtex-email/preview": "${fileUrl('@vtex-email/preview')}"`,
        '',
      ].join('\n'),
    )
    await writeFile(
      path.join(consumer, 'package.json'),
      `${JSON.stringify(
        {
          name: 'partial-consumer',
          private: true,
          type: 'module',
          dependencies: {
            '@vtex-email/core': fileUrl('@vtex-email/core'),
            '@vtex-email/cli': fileUrl('@vtex-email/cli'),
            '@vtex-email/preview': fileUrl('@vtex-email/preview'),
          },
        },
        null,
        2,
      )}\n`,
    )

    const consumerInstall = await run('pnpm', ['install'], consumer)
    if (consumerInstall.code !== 0) {
      throw new Error(`consumer install failed:\n${consumerInstall.stderr}\n${consumerInstall.stdout}`)
    }

    // Limitation while packages are unpublished on npmjs: this proves file-tarball
    // combination only, not registry resolution of "new Preview + old CLI from npm".
  })
})
