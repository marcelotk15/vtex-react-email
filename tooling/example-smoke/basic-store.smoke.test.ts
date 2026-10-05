import { buildProject, validateProject } from '@vtex-email/cli/project'
import { createTempDir, linkWorkspaceModules, removeTempDir, resolveCliBin } from '@vtex-email/test-harness'
import { spawn } from 'node:child_process'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const example = path.resolve('examples/basic-store')

describe('basic-store example smoke', () => {
  it('validates and builds an isolated copy of the example', async () => {
    const root = await createTempDir('vtex-example-smoke-')
    try {
      await mkdir(root, { recursive: true })
      await cp(path.join(example, 'src'), path.join(root, 'src'), { recursive: true })
      await cp(path.join(example, 'vtex-email.config.ts'), path.join(root, 'vtex-email.config.ts'))
      await writeFile(
        path.join(root, 'package.json'),
        `${JSON.stringify({ name: 'vtex-email-example-smoke', private: true, type: 'module' }, null, 2)}\n`,
      )
      await linkWorkspaceModules(root)

      const configPath = path.join(root, 'vtex-email.config.ts')
      const validated = await validateProject({ configPath })
      expect(validated).toMatchObject({ ok: true })

      const built = await buildProject({ configPath })
      expect(built).toMatchObject({ ok: true })
      expect(built.emails.some((email) => email.id === '01-confirmed')).toBe(true)

      const script = await resolveCliBin()
      const version = await runNode(script, ['--version'], root)
      expect(version.code).toBe(0)
    } finally {
      await removeTempDir(root)
    }
  }, 180_000)
})

function runNode(
  script: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, windowsHide: true })
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
