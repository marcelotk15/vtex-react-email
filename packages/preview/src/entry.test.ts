import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageDir = path.resolve('packages/preview')
const installedBundle = path.join(packageDir, '.cache', 'preview.mjs')
const entry = pathToFileURL(fileURLToPath(new URL('./entry.mjs', import.meta.url))).href

describe('preview bundle cache', () => {
  it('writes a unique temporary bundle outside the package and removes it on exit', async () => {
    const before = await fingerprint(installedBundle)
    const [left, right] = await Promise.all([importBundle(), importBundle()])
    expect(left).toMatchObject({ code: 0 })
    expect(right).toMatchObject({ code: 0 })

    const files = [left.stdout.trim(), right.stdout.trim()]
    expect(new Set(files).size).toBe(2)
    for (const file of files) {
      expect(file.includes(' ')).toBe(true)
      expect(outside(tmpdir(), file)).toBe(false)
      expect(outside(packageDir, file)).toBe(true)
      expect(file.split(/[\\/]/).includes('dist')).toBe(false)
      await expect(access(file)).rejects.toThrow()
    }
    expect(await fingerprint(installedBundle)).toBe(before)
    await expect(access(path.join(packageDir, 'node_modules', 'esbuild', 'package.json'))).resolves.toBeUndefined()
  }, 120_000)
})

function importBundle(): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { previewBundlePath } from ${JSON.stringify(entry)};\nprocess.stdout.write(previewBundlePath);`,
    ],
    { cwd: process.cwd(), windowsHide: true },
  )
  return collect(child)
}

function outside(root: string, file: string): boolean {
  const relative = path.relative(root, file)
  return relative.startsWith('..') || path.isAbsolute(relative)
}

async function fingerprint(file: string): Promise<string | null> {
  try {
    const content = await readFile(file)
    return createHash('sha256').update(content).digest('hex')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
}

function collect(child: ReturnType<typeof spawn>): Promise<{ code: number; stdout: string; stderr: string }> {
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
