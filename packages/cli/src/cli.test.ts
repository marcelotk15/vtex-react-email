// The process checks below run on the Node pin from ADR 0001 (Windows). Linux and macOS remain pending.
import { spawn } from 'node:child_process'
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve('examples/basic-store')

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

async function expectedCliVersion(): Promise<string> {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
  }

  return manifest.version
}

describe('vtex-email executable', () => {
  it('answers help, version, and invalid arguments', async () => {
    const script = await binScript()
    const help = await runNode(script, ['--help'], root)
    expect(help.code).toBe(0)
    expect(help.stdout).toContain('vtex-email build')
    expect(help.stdout).toContain('vtex-email dev')
    expect(help.stderr).toBe('')

    const version = await runNode(script, ['--version'], root)
    expect(version.code).toBe(0)
    expect(version.stdout.trim()).toBe(await expectedCliVersion())

    const unknown = await runNode(script, ['deploy'], root)
    expect(unknown.code).toBe(2)
    expect(unknown.stderr).toContain('Unknown command')

    const preview = await runNode(script, ['preview', 'order-confirmed'], root)
    expect(preview.code).toBe(2)
    expect(preview.stderr).toContain('--fixture')

    const flagged = await runNode(script, ['--unknown', '--format', 'json'], root)
    expect(flagged.code).toBe(2)
    const report = JSON.parse(flagged.stdout) as { formatVersion: number; exitCode: number; ok: boolean }
    expect(report).toMatchObject({ formatVersion: 1, exitCode: 2, ok: false })
    expect(flagged.stdout.trim().endsWith('}')).toBe(true)
    expect(flagged.stderr).toContain('Unknown option')
    expect(flagged.stderr.includes('{')).toBe(false)
  }, 20_000)

  it('exposes the workspace bin through pnpm exec', async () => {
    const result = await runShell('pnpm exec vtex-email --version', root)
    expect(result).toMatchObject({ code: 0 })
    expect(result.stdout.trim()).toBe(await expectedCliVersion())
  })

  it('builds the copied store from another directory when the path contains spaces', async () => {
    const project = await mkdtemp(path.join(root, '.cli- space-'))
    const elsewhere = await mkdtemp(path.join(root, '.cli- other '))
    const configPath = await copyStore(project)
    const script = await binScript()
    try {
      const validated = await runNode(script, ['validate', '--config', configPath, '--format', 'json'], elsewhere)
      expect(validated).toMatchObject({ code: 0 })
      const report = JSON.parse(validated.stdout) as {
        formatVersion: number
        ok: boolean
        wrote: string[]
        unverifiedCapabilities: Array<{ templateId: string; name: string; evidence: string; severity: string }>
      }
      expect(report.formatVersion).toBe(1)
      expect(report.ok).toBe(true)
      expect(report.wrote).toEqual([])
      expect(validated.stdout.includes(project)).toBe(false)
      expect(
        report.unverifiedCapabilities.some(
          (item) => item.templateId === 'order-confirmed' && item.name === 'eq' && item.evidence === 'experimental',
        ),
      ).toBe(true)
      expect(report.unverifiedCapabilities.some((item) => item.templateId === 'auth-code' && item.name === 'eq')).toBe(
        false,
      )
      expect(validated.stderr).toContain('homologation experimental')
      expect(await missing(path.join(project, 'dist'))).toBe(true)

      const built = await runNode(script, ['build', '--config', configPath], elsewhere)
      expect(built).toMatchObject({ code: 0 })
      expect(built.stdout).toContain('TARGET001')
      const orderFile = path.join(project, 'dist', 'order-confirmed.html')
      const authFile = path.join(project, 'dist', 'locales', 'pt-BR', 'auth-code.html')
      const orderBytes = await readFile(orderFile, 'utf8')
      const authBytes = await readFile(authFile, 'utf8')
      expect(orderBytes).toContain('{{#eq')

      const partial = await runNode(script, ['build', 'order-confirmed', '--config', configPath], elsewhere)
      expect(partial).toMatchObject({ code: 0 })
      expect(await readFile(authFile, 'utf8')).toBe(authBytes)

      const english = path.join(project, 'dist', 'locales', 'en-US', 'order-confirmed.html')
      const englishBytes = await readFile(english, 'utf8')
      const locale = await runNode(
        script,
        ['build', 'order-confirmed', '--locale', 'pt-BR', '--config', configPath],
        elsewhere,
      )
      expect(locale).toMatchObject({ code: 0 })
      expect(await readFile(orderFile, 'utf8')).toBe(orderBytes)
      expect(await readFile(english, 'utf8')).toBe(englishBytes)
      expect(await readFile(authFile, 'utf8')).toBe(authBytes)

      const previewDir = path.join(project, 'preview')
      const preview = await runNode(
        script,
        ['preview', 'order-confirmed', '--fixture', 'delivery', '--out', previewDir, '--config', configPath],
        elsewhere,
      )
      expect(preview).toMatchObject({ code: 0 })
      const resolved = await readFile(path.join(previewDir, 'order-confirmed.delivery.html'), 'utf8')
      expect(resolved.includes('{{')).toBe(false)
      expect(resolved.includes('Hello,')).toBe(true)
      expect(await missing(path.join(project, 'dist', 'order-confirmed.delivery.html'))).toBe(true)

      const promoted = await runNode(
        script,
        ['build', '--config', configPath, '--warnings-as-errors', '--format', 'json'],
        elsewhere,
      )
      expect(promoted.code).toBe(1)
      expect((JSON.parse(promoted.stdout) as { ok: boolean; wrote: string[] }).wrote).toEqual([])
      expect(await readFile(orderFile, 'utf8')).toBe(orderBytes)

      const stale = path.join(project, 'dist', 'locales', 'fr-FR', 'order-confirmed.html')
      await mkdir(path.dirname(stale), { recursive: true })
      await writeFile(stale, 'stale', 'utf8')
      const manifestPath = path.join(project, 'dist', 'manifest.json')
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        emails: Array<{ id: string; files: Array<{ name: string; sha256: string; role: string; locale?: string }> }>
      }
      manifest.emails
        .find((email) => email.id === 'order-confirmed')
        ?.files.push({
          name: 'locales/fr-FR/order-confirmed.html',
          sha256: 'stale',
          role: 'locale',
          locale: 'fr-FR',
        })
      await writeFile(manifestPath, JSON.stringify(manifest))
      const cleaned = await runNode(script, ['build', '--config', configPath], elsewhere)
      expect(cleaned).toMatchObject({ code: 0 })
      expect(await missing(stale)).toBe(true)
      expect(await readFile(authFile, 'utf8')).toBe(authBytes)

      await writeFile(path.join(project, 'locales', 'pt-BR.json'), '{', 'utf8')
      const failed = await runNode(script, ['build', '--config', configPath, '--format', 'json'], elsewhere)
      expect(failed.code).toBe(1)
      const failure = JSON.parse(failed.stdout) as { ok: boolean; wrote: string[] }
      expect(failure.ok).toBe(false)
      expect(failure.wrote).toEqual([])
      expect(await readFile(orderFile, 'utf8')).toBe(orderBytes)
      expect(await readFile(authFile, 'utf8')).toBe(authBytes)
    } finally {
      await rm(project, { recursive: true, force: true })
      await rm(elsewhere, { recursive: true, force: true })
    }
  }, 360_000)
})

async function binScript(): Promise<string> {
  const packagePath = path.join(root, 'node_modules', '@vtex-email', 'cli', 'package.json')
  const parsed = JSON.parse(await readFile(packagePath, 'utf8')) as { bin?: { 'vtex-email'?: string } }
  const relative = parsed.bin?.['vtex-email']
  if (!relative) throw new Error('The workspace package does not declare bin.vtex-email.')
  return path.resolve(path.dirname(packagePath), relative)
}

async function copyStore(destination: string): Promise<string> {
  await mkdir(destination, { recursive: true })
  for (const name of ['emails', 'schemas', 'locales', 'fixtures']) {
    await cp(path.join(root, name), path.join(destination, name), { recursive: true })
  }
  await cp(path.join(root, 'vtex-target.ts'), path.join(destination, 'vtex-target.ts'))
  await cp(path.join(root, 'vtex-email.config.ts'), path.join(destination, 'vtex-email.config.ts'))
  return path.join(destination, 'vtex-email.config.ts')
}

function runShell(command: string, cwd: string): Promise<RunResult> {
  return collect(spawn(command, { cwd, shell: true, windowsHide: true }))
}

function runNode(script: string, args: string[], cwd: string): Promise<RunResult> {
  return runCommand(process.execPath, [script, ...args], cwd)
}

function runCommand(command: string, args: string[], cwd: string): Promise<RunResult> {
  return collect(spawn(command, args, { cwd, windowsHide: true }))
}

function collect(child: ReturnType<typeof spawn>): Promise<RunResult> {
  return new Promise((resolve, reject) => {
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
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

async function missing(file: string): Promise<boolean> {
  try {
    await access(file)
    return false
  } catch {
    return true
  }
}
