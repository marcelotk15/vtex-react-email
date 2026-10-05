import {
  createTempDirWithSpaces,
  expectedCliVersion,
  removeTempDir,
  repoRoot,
  resolveCliBin,
  SEED_GREETING_EN,
  SEED_OPS,
  SEED_WELCOME,
  writeSeedInto,
} from '@vtex-email/test-harness'
// The process checks below run on the Node pin from ADR 0001 (Windows). Linux and macOS remain pending.
import { spawn } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

describe('vtex-email executable', () => {
  it('answers help, version, and invalid arguments', async () => {
    const cwd = await createTempDirWithSpaces('vtex cli cwd ')
    const script = await resolveCliBin()
    try {
      const help = await runNode(script, ['--help'], cwd)
      expect(help.code).toBe(0)
      expect(help.stdout).toContain('vtex-email build')
      expect(help.stdout).toContain('vtex-email dev')
      expect(help.stderr).toBe('')

      const version = await runNode(script, ['--version'], cwd)
      expect(version.code).toBe(0)
      expect(version.stdout.trim()).toBe(await expectedCliVersion())

      const unknown = await runNode(script, ['deploy'], cwd)
      expect(unknown.code).toBe(2)
      expect(unknown.stderr).toContain('Unknown command')

      const preview = await runNode(script, ['preview', SEED_WELCOME], cwd)
      expect(preview.code).toBe(2)
      expect(preview.stderr).toContain('--fixture')

      const flagged = await runNode(script, ['--unknown', '--format', 'json'], cwd)
      expect(flagged.code).toBe(2)
      const report = JSON.parse(flagged.stdout) as { formatVersion: number; exitCode: number; ok: boolean }
      expect(report).toMatchObject({ formatVersion: 1, exitCode: 2, ok: false })
      expect(flagged.stdout.trim().endsWith('}')).toBe(true)
      expect(flagged.stderr).toContain('Unknown option')
      expect(flagged.stderr.includes('{')).toBe(false)
    } finally {
      await removeTempDir(cwd)
    }
  }, 20_000)

  it('exposes the workspace bin through pnpm exec', async () => {
    const result = await runShell('pnpm exec vtex-email --version', repoRoot)
    expect(result).toMatchObject({ code: 0 })
    expect(result.stdout.trim()).toBe(await expectedCliVersion())
  })

  it('builds the seed project from another directory when the path contains spaces', async () => {
    const project = await createTempDirWithSpaces('vtex cli space-')
    const elsewhere = await createTempDirWithSpaces('vtex cli other ')
    const { configPath } = await writeSeedInto(project)
    const script = await resolveCliBin()
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
          (item) => item.templateId === SEED_WELCOME && item.name === 'eq' && item.evidence === 'experimental',
        ),
      ).toBe(true)
      expect(report.unverifiedCapabilities.some((item) => item.templateId === SEED_OPS && item.name === 'eq')).toBe(
        true,
      )
      expect(validated.stderr).toContain('homologation experimental')
      expect(await missing(path.join(project, 'dist'))).toBe(true)

      const built = await runNode(script, ['build', '--config', configPath], elsewhere)
      expect(built).toMatchObject({ code: 0 })
      expect(built.stdout).toContain('TARGET001')
      const welcomeFile = path.join(project, 'dist', 'welcome.html')
      const opsFile = path.join(project, 'dist', 'locales', 'pt-BR', 'ops-notice.html')
      const welcomeBytes = await readFile(welcomeFile, 'utf8')
      const opsBytes = await readFile(opsFile, 'utf8')
      expect(welcomeBytes).toContain('{{#eq')

      const partial = await runNode(script, ['build', SEED_WELCOME, '--config', configPath], elsewhere)
      expect(partial).toMatchObject({ code: 0 })
      expect(await readFile(opsFile, 'utf8')).toBe(opsBytes)

      const english = path.join(project, 'dist', 'locales', 'en-US', 'welcome.html')
      const englishBytes = await readFile(english, 'utf8')
      const locale = await runNode(
        script,
        ['build', SEED_WELCOME, '--locale', 'pt-BR', '--config', configPath],
        elsewhere,
      )
      expect(locale).toMatchObject({ code: 0 })
      expect(await readFile(welcomeFile, 'utf8')).toBe(welcomeBytes)
      expect(await readFile(english, 'utf8')).toBe(englishBytes)
      expect(await readFile(opsFile, 'utf8')).toBe(opsBytes)

      const previewDir = path.join(project, 'preview')
      const preview = await runNode(
        script,
        ['preview', SEED_WELCOME, '--fixture', 'full', '--out', previewDir, '--config', configPath],
        elsewhere,
      )
      expect(preview).toMatchObject({ code: 0 })
      const resolved = await readFile(path.join(previewDir, 'welcome.full.html'), 'utf8')
      expect(resolved.includes('{{')).toBe(false)
      expect(resolved.includes(SEED_GREETING_EN)).toBe(true)
      expect(await missing(path.join(project, 'dist', 'welcome.full.html'))).toBe(true)

      const promoted = await runNode(
        script,
        ['build', '--config', configPath, '--warnings-as-errors', '--format', 'json'],
        elsewhere,
      )
      expect(promoted.code).toBe(1)
      expect((JSON.parse(promoted.stdout) as { ok: boolean; wrote: string[] }).wrote).toEqual([])
      expect(await readFile(welcomeFile, 'utf8')).toBe(welcomeBytes)

      const stale = path.join(project, 'dist', 'locales', 'fr-FR', 'welcome.html')
      await mkdir(path.dirname(stale), { recursive: true })
      await writeFile(stale, 'stale', 'utf8')
      const manifestPath = path.join(project, 'dist', 'manifest.json')
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        emails: Array<{ id: string; files: Array<{ name: string; sha256: string; role: string; locale?: string }> }>
      }
      manifest.emails
        .find((email) => email.id === SEED_WELCOME)
        ?.files.push({
          name: 'locales/fr-FR/welcome.html',
          sha256: 'stale',
          role: 'locale',
          locale: 'fr-FR',
        })
      await writeFile(manifestPath, JSON.stringify(manifest))
      const cleaned = await runNode(script, ['build', '--config', configPath], elsewhere)
      expect(cleaned).toMatchObject({ code: 0 })
      expect(await missing(stale)).toBe(true)
      expect(await readFile(opsFile, 'utf8')).toBe(opsBytes)

      await writeFile(path.join(project, 'src', 'locales', 'pt-BR.json'), '{', 'utf8')
      const failed = await runNode(script, ['build', '--config', configPath, '--format', 'json'], elsewhere)
      expect(failed.code).toBe(1)
      const failure = JSON.parse(failed.stdout) as { ok: boolean; wrote: string[] }
      expect(failure.ok).toBe(false)
      expect(failure.wrote).toEqual([])
      expect(await readFile(welcomeFile, 'utf8')).toBe(welcomeBytes)
      expect(await readFile(opsFile, 'utf8')).toBe(opsBytes)
    } finally {
      await removeTempDir(project)
      await removeTempDir(elsewhere)
    }
  }, 360_000)
})

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
