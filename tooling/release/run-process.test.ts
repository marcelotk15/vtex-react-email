import { describe, expect, it } from 'vitest'

import { classifyPublishResult } from './resume-metadata.mjs'
import { runProcess } from './run-process.mjs'

describe('runProcess + classifyPublishResult', () => {
  it('recognizes a real successful process result as published', async () => {
    const result = await runProcess(process.execPath, ['-e', 'process.exit(0)'], {
      cwd: process.cwd(),
      shell: false,
    })
    expect(result).toMatchObject({ exitCode: 0 })
    expect('code' in result).toBe(false)
    expect(classifyPublishResult(result).kind).toBe('published')
  })

  it('treats spawn start failures as non-zero results', async () => {
    const result = await runProcess('this-command-definitely-does-not-exist-vtex-email', [], {
      cwd: process.cwd(),
      shell: false,
    })
    expect(result.exitCode).not.toBe(0)
    expect(classifyPublishResult(result).kind).not.toBe('published')
  })

  it('does not treat legacy { code: 0 } as success', () => {
    expect(classifyPublishResult({ code: 0, stdout: 'ok', stderr: '' } as { exitCode?: number }).kind).toBe('failed')
  })
})
