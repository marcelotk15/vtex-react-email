import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { packPublishablePackages, readPackageJsonFromTarball, sha256File } from './pack-artifacts.mjs'

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

describe('pack artifacts and workspace: conversion', { timeout: 120_000 }, () => {
  it('pnpm pack rewrites workspace:* to the concrete dependency version', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-pack-'))
    tempDirs.push(root)
    await writeFile(
      path.join(root, 'package.json'),
      `${JSON.stringify({ name: 'root', private: true, packageManager: 'pnpm@12.8.1' }, null, 2)}\n`,
    )
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')

    for (const [dirName, name, version, deps] of [
      ['cli', '@vtex-email/cli', '0.2.0', {}],
      ['preview', '@vtex-email/preview', '0.3.0', { '@vtex-email/cli': 'workspace:*' }],
    ] as const) {
      const pkgDir = path.join(root, 'packages', dirName)
      await mkdir(path.join(pkgDir, 'dist'), { recursive: true })
      await writeFile(path.join(pkgDir, 'dist', 'index.js'), 'export {}\n')
      await writeFile(
        path.join(pkgDir, 'package.json'),
        `${JSON.stringify(
          {
            name,
            version,
            files: ['dist'],
            dependencies: deps,
          },
          null,
          2,
        )}\n`,
      )
    }

    execFileSync('pnpm', ['install'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HUSKY: '0' },
      shell: process.platform === 'win32',
    })

    const outDir = path.join(root, 'out')
    const { artifacts, manifest } = await packPublishablePackages({
      root,
      outDir,
      packageDirs: ['cli', 'preview'],
    })
    expect(manifest.packages).toHaveLength(2)

    const preview = artifacts.find((item) => item.name === '@vtex-email/preview')
    expect(preview).toBeTruthy()
    const pkgJson = await readPackageJsonFromTarball(preview!.tarball)
    expect(pkgJson.dependencies?.['@vtex-email/cli']).toBe('0.2.0')
    expect(await sha256File(preview!.tarball)).toBe(preview!.sha256)
  })
})
