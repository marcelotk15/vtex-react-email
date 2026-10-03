import { spawn } from 'node:child_process'

/**
 * Run a subprocess and return a stable result shape for classifiers.
 *
 * Always resolves with `{ exitCode, stdout, stderr }` — never `{ code }`.
 * Spawn/start failures resolve with a non-zero exitCode instead of rejecting.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{
 *   cwd?: string
 *   env?: NodeJS.ProcessEnv
 *   shell?: boolean
 *   inheritStdio?: boolean
 * }} [options]
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
export function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let child
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: options.shell ?? process.platform === 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      finish({
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
      })
      return
    }

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      stdout += chunk
      if (options.inheritStdio) process.stdout.write(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk
      if (options.inheritStdio) process.stderr.write(chunk)
    })

    child.on('error', (error) => {
      finish({
        exitCode: 1,
        stdout,
        stderr: `${stderr}${stderr ? '\n' : ''}${error.message}`,
      })
    })

    child.on('close', (code) => {
      finish({ exitCode: code ?? 1, stdout, stderr })
    })
  })
}
