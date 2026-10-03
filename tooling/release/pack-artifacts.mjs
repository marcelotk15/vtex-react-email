import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createGunzip } from 'node:zlib'

export const PUBLISHABLE_PACKAGE_DIRS = ['core', 'vtex', 'react', 'cli', 'preview']

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 */
function run(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
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

/** @param {string} filePath */
export async function sha256File(filePath) {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest('hex')
}

/**
 * Pack publishable packages with pnpm (converts workspace: protocol).
 *
 * @param {{
 *   root: string
 *   outDir: string
 *   packageDirs?: readonly string[]
 * }} options
 */
export async function packPublishablePackages(options) {
  const packageDirs = options.packageDirs ?? PUBLISHABLE_PACKAGE_DIRS
  await mkdir(options.outDir, { recursive: true })
  /** @type {Array<{ dir: string, name: string, version: string, tarball: string, sha256: string }>} */
  const artifacts = []

  for (const dirName of packageDirs) {
    const pkgDir = path.join(options.root, 'packages', dirName)
    const packageJson = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8'))
    if (packageJson.private === true) continue

    const result = await run('pnpm', ['pack', '--pack-destination', options.outDir], pkgDir)
    if (result.code !== 0) {
      throw new Error(`pnpm pack failed for ${dirName}: ${result.stderr}\n${result.stdout}`)
    }
    const line = result.stdout
      .trim()
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.endsWith('.tgz'))
    if (!line) throw new Error(`No tarball listed for ${dirName}: ${result.stdout}`)
    const tarball = path.isAbsolute(line) ? line : path.join(options.outDir, path.basename(line))
    const digest = await sha256File(tarball)
    artifacts.push({
      dir: dirName,
      name: packageJson.name,
      version: packageJson.version,
      tarball,
      sha256: digest,
    })
  }

  const manifest = {
    commit: process.env.GITHUB_SHA ?? process.env.RELEASE_COMMIT_SHA ?? null,
    packages: artifacts.map(({ dir, name, version, tarball, sha256 }) => ({
      dir,
      name,
      version,
      file: path.basename(tarball),
      sha256,
    })),
  }
  await writeFile(path.join(options.outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return { artifacts, manifest }
}

/**
 * @param {string} tarballPath
 */
export async function readPackageJsonFromTarball(tarballPath) {
  const tarResult = await run('tar', ['-xOf', tarballPath, 'package/package.json'], path.dirname(tarballPath))
  if (tarResult.code === 0 && tarResult.stdout.trim()) {
    return JSON.parse(tarResult.stdout)
  }

  let buffer = Buffer.alloc(0)
  /** @type {Record<string, unknown> | null} */
  let found = null
  const input = createReadStream(tarballPath).pipe(createGunzip())
  for await (const chunk of input) {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 512) {
      const header = buffer.subarray(0, 512)
      const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
      if (!name) {
        buffer = buffer.subarray(512)
        continue
      }
      const sizeOctal = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim()
      const size = Number.parseInt(sizeOctal || '0', 8)
      const dataStart = 512
      const padded = Math.ceil(size / 512) * 512
      if (buffer.length < dataStart + padded) break
      const data = buffer.subarray(dataStart, dataStart + size)
      buffer = buffer.subarray(dataStart + padded)
      if (name === 'package/package.json' || name.endsWith('/package.json')) {
        found = JSON.parse(data.toString('utf8'))
        break
      }
    }
    if (found) break
  }
  if (!found) {
    throw new Error(`Could not read package.json from ${tarballPath}: ${tarResult.stderr}`)
  }
  return found
}

/**
 * @param {{
 *   manifestPath: string
 *   artifactsDir: string
 *   expectedCommit?: string | null
 * }} options
 */
export async function loadAndVerifyManifest(options) {
  const manifest = JSON.parse(await readFile(options.manifestPath, 'utf8'))
  if (options.expectedCommit && manifest.commit && manifest.commit !== options.expectedCommit) {
    throw new Error(`Artifact manifest commit ${manifest.commit} does not match expected ${options.expectedCommit}`)
  }
  const verified = []
  for (const entry of manifest.packages) {
    const filePath = path.join(options.artifactsDir, entry.file)
    const digest = await sha256File(filePath)
    if (digest !== entry.sha256) {
      throw new Error(`Hash mismatch for ${entry.file}: expected ${entry.sha256}, got ${digest}`)
    }
    verified.push({ ...entry, tarball: filePath })
  }
  return { manifest, packages: verified }
}
