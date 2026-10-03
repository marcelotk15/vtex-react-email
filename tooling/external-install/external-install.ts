import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const packages = ['core', 'vtex', 'react', 'cli', 'preview'] as const

export async function runExternalInstall(): Promise<{
  ok: true
  hashes: Record<string, string>
}> {
  await ensurePackagesBuilt()

  const packRoot = await mkdtemp(path.join(tmpdir(), 'vtex-email-packs-'))
  const consumer = await mkdtemp(path.join(tmpdir(), 'vtex-email-consumer-'))
  try {
    const tarballs = await packPackages(packRoot)
    await writeConsumer(consumer, tarballs)
    const install = await run('pnpm', ['install'], consumer)
    if (install.code !== 0) throw new Error(`pnpm install failed:\n${install.stderr}\n${install.stdout}`)

    await assertNoSourceLinks(consumer)

    const validated = await run('pnpm', ['exec', 'vtex-email', 'validate'], consumer)
    if (validated.code !== 0) throw new Error(`validate failed:\n${validated.stderr}\n${validated.stdout}`)

    const built = await run('pnpm', ['exec', 'vtex-email', 'build'], consumer)
    if (built.code !== 0) throw new Error(`build failed:\n${built.stderr}\n${built.stdout}`)

    const hashes = await hashTree(path.join(consumer, 'dist'))
    const baseline = JSON.parse(await readFile(path.join(here, 'baseline-hashes.json'), 'utf8')) as {
      files: Record<string, string>
    }
    for (const [file, expected] of Object.entries(baseline.files)) {
      if (file === 'manifest.json') continue
      if (hashes[file] !== expected) {
        throw new Error(`Baseline mismatch for ${file}: expected ${expected}, got ${hashes[file] ?? 'missing'}`)
      }
    }
    if (!hashes['manifest.json']) throw new Error('Missing manifest.json')

    await writeFile(path.join(consumer, 'vite.config.ts'), `export default { server: { port: 59999 } }\n`)
    const port = 34567
    await writeFile(
      path.join(consumer, 'vtex-email.config.ts'),
      (await readFile(path.join(consumer, 'vtex-email.config.ts'), 'utf8')).replace('port: 3000', `port: ${port}`),
    )

    const dev = spawn('pnpm', ['exec', 'vtex-email', 'dev'], {
      cwd: consumer,
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      const url = await waitForUrl(dev, 90_000)
      if (!url.includes(`127.0.0.1:${port}`)) throw new Error(`Unexpected preview URL: ${url}`)
      const page = await fetch(url)
      const html = await page.text()
      if (!html.includes('<div id="root">')) throw new Error('Preview shell missing root')
      const script = /src="([^"]+\.js)"/.exec(html)?.[1]
      if (!script?.startsWith('/assets/')) throw new Error('Missing hashed script asset')
      const asset = await fetch(new URL(script, url))
      if (!asset.ok) throw new Error(`Asset failed: ${script}`)
      const cssHref = /href="([^"]+\.css)"/.exec(html)?.[1]
      if (cssHref) {
        const css = await fetch(new URL(cssHref, url))
        if (!css.ok) throw new Error(`CSS failed: ${cssHref}`)
      }
      const fontHref = /url\((\/assets\/[^)]+\.woff2)\)/.exec(
        await (await fetch(new URL(cssHref ?? script, url))).text(),
      )
      if (cssHref) {
        const cssText = await (await fetch(new URL(cssHref, url))).text()
        const font = /url\((?:'|")?([^'")]+?\.woff2)/.exec(cssText)?.[1]
        if (font) {
          const fontUrl = font.startsWith('http') ? font : new URL(font, url).href
          if (fontUrl.startsWith('http') && !fontUrl.includes('127.0.0.1')) {
            throw new Error(`Font loaded from external host: ${fontUrl}`)
          }
          const fontResponse = await fetch(fontUrl.startsWith('http') ? fontUrl : new URL(font, url))
          if (!fontResponse.ok) throw new Error(`Font failed: ${font}`)
        }
      }
      void fontHref

      await writeFile(
        path.join(consumer, 'components', 'shared.tsx'),
        `export function Shared() { return <span>shared-updated</span> }\n`,
      )
      await sleep(1_000)
      const fixture = path.join(consumer, 'fixtures', 'auth-code', 'default.jsonc')
      const before = await readFile(fixture, 'utf8')
      await writeFile(fixture, before.replace('AUTH-KEEP', 'AUTH-WATCH'))
      await sleep(1_000)
      await rm(path.join(consumer, 'emails', 'auth-code.email.tsx'))
      await sleep(1_000)
    } finally {
      await stopProcess(dev)
    }

    const stillOpen = await reachable(port)
    if (stillOpen) throw new Error(`Port ${port} remained open after close.`)
    await removeTree(packRoot)
    await removeTree(consumer)
    return { ok: true, hashes }
  } catch (error) {
    await removeTree(packRoot)
    await removeTree(consumer)
    throw error
  }
}

async function ensurePackagesBuilt(): Promise<void> {
  const required = [
    path.join(root, 'packages/cli/dist/bin.js'),
    path.join(root, 'packages/cli/dist/project.js'),
    path.join(root, 'packages/preview/dist/index.js'),
    path.join(root, 'packages/preview/dist/client/index.html'),
    path.join(root, 'packages/core/dist/index.js'),
    path.join(root, 'packages/react/dist/index.js'),
    path.join(root, 'packages/vtex/dist/index.js'),
  ]
  const missing = []
  for (const file of required) {
    try {
      await access(file)
    } catch {
      missing.push(file)
    }
  }
  if (missing.length === 0) return
  const built = await run(process.execPath, [path.join(root, 'scripts/build-packages.mjs')], root)
  if (built.code !== 0) throw new Error(`package build failed:\n${built.stderr}\n${built.stdout}`)
}

async function packPackages(packRoot: string): Promise<Record<(typeof packages)[number], string>> {
  const stage = path.join(packRoot, 'stage')
  await mkdir(stage, { recursive: true })
  const tarballs = {} as Record<(typeof packages)[number], string>
  for (const name of packages) {
    const source = path.join(root, 'packages', name)
    const staged = path.join(stage, name)
    await cp(source, staged, {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}.cache`),
    })
    const packageJsonPath = path.join(staged, 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    for (const field of ['dependencies', 'devDependencies'] as const) {
      const deps = packageJson[field]
      if (!deps) continue
      for (const [dep, value] of Object.entries(deps)) {
        if (value.startsWith('workspace:')) deps[dep] = '0.0.0'
      }
    }
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
    const result = await run('pnpm', ['pack', '--pack-destination', packRoot], staged)
    if (result.code !== 0) throw new Error(`pnpm pack failed for ${name}: ${result.stderr}\n${result.stdout}`)
    const line = result.stdout
      .trim()
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.endsWith('.tgz'))
    if (!line) throw new Error(`No tarball listed for ${name}: ${result.stdout}`)
    tarballs[name] = path.isAbsolute(line) ? line : path.join(packRoot, path.basename(line))
  }
  return tarballs
}

async function writeConsumer(consumer: string, tarballs: Record<(typeof packages)[number], string>): Promise<void> {
  await cp(path.join(root, 'examples/basic-store/emails'), path.join(consumer, 'emails'), { recursive: true })
  await cp(path.join(root, 'examples/basic-store/schemas'), path.join(consumer, 'schemas'), { recursive: true })
  await cp(path.join(root, 'examples/basic-store/locales'), path.join(consumer, 'locales'), { recursive: true })
  await cp(path.join(root, 'examples/basic-store/fixtures'), path.join(consumer, 'fixtures'), { recursive: true })
  await mkdir(path.join(consumer, 'components'), { recursive: true })
  await writeFile(
    path.join(consumer, 'components', 'shared.tsx'),
    `export function Shared() { return <span>shared</span> }\n`,
  )
  await cp(path.join(root, 'examples/basic-store/vtex-target.ts'), path.join(consumer, 'vtex-target.ts'))
  await cp(path.join(root, 'examples/basic-store/vtex-email.config.ts'), path.join(consumer, 'vtex-email.config.ts'))

  const packageJson = {
    name: 'vtex-email-external-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@react-email/components': '1.0.12',
      '@vtex-email/cli': pathToFileUrl(tarballs.cli),
      '@vtex-email/core': pathToFileUrl(tarballs.core),
      '@vtex-email/preview': pathToFileUrl(tarballs.preview),
      '@vtex-email/react': pathToFileUrl(tarballs.react),
      '@vtex-email/vtex': pathToFileUrl(tarballs.vtex),
      esbuild: '0.28.2',
      react: '19.3.0',
      'react-dom': '19.3.0',
      zod: '4.6.5',
    },
  }
  // pnpm 12 reads overrides / allowBuilds from pnpm-workspace.yaml, not package.json#pnpm.
  await writeFile(
    path.join(consumer, 'pnpm-workspace.yaml'),
    [
      'overrides:',
      `  "@vtex-email/cli": "${pathToFileUrl(tarballs.cli)}"`,
      `  "@vtex-email/core": "${pathToFileUrl(tarballs.core)}"`,
      `  "@vtex-email/preview": "${pathToFileUrl(tarballs.preview)}"`,
      `  "@vtex-email/react": "${pathToFileUrl(tarballs.react)}"`,
      `  "@vtex-email/vtex": "${pathToFileUrl(tarballs.vtex)}"`,
      '  tailwindcss: 4.1.18',
      '',
      'allowBuilds:',
      '  esbuild: true',
      '',
    ].join('\n'),
  )
  await writeFile(path.join(consumer, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
}

function pathToFileUrl(file: string): string {
  return `file:${file.replaceAll('\\', '/')}`
}

async function assertNoSourceLinks(consumer: string): Promise<void> {
  const require = createRequire(path.join(consumer, 'package.json'))
  for (const name of [
    '@vtex-email/core',
    '@vtex-email/cli',
    '@vtex-email/preview',
    '@vtex-email/react',
    '@vtex-email/vtex',
  ]) {
    const resolved = require.resolve(name)
    const real = await realpath(resolved)
    const normalized = real.replaceAll('\\', '/')
    if (normalized.includes('/packages/') && normalized.includes('/src/')) {
      throw new Error(`${name} resolved to monorepo source: ${real}`)
    }
    if (!normalized.includes('/dist/')) {
      throw new Error(`${name} did not resolve under dist: ${real}`)
    }
  }
}

async function hashTree(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  async function walk(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else {
        const relative = path.relative(directory, full).split(path.sep).join('/')
        files[relative] = createHash('sha256')
          .update(await readFile(full))
          .digest('hex')
      }
    }
  }
  await walk(directory)
  return files
}

function run(command: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: process.platform === 'win32', windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

function waitForUrl(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for preview URL.\n${stdout}\n${stderr}`))
    }, timeoutMs)
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
      const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+\//)
      if (match) {
        clearTimeout(timer)
        resolve(match[0])
      }
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (code) => {
      if (code) {
        clearTimeout(timer)
        reject(new Error(`dev exited early (${code}): ${stderr}\n${stdout}`))
      }
    })
  })
}

async function stopProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.signalCode) return
  if (process.platform === 'win32' && child.pid) {
    await run('taskkill', ['/pid', String(child.pid), '/t', '/f'], process.cwd()).catch(() => undefined)
  } else {
    child.kill('SIGTERM')
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 10_000)
    child.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
  await sleep(500)
}

async function removeTree(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true })
      return
    } catch {
      await sleep(300 * (attempt + 1))
    }
  }
}

async function reachable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`)
    return response.ok
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
