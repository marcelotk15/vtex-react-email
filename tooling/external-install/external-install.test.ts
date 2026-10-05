import { describe, expect, it } from 'vitest'

import { runExternalInstall } from './external-install'

describe('external package installation', () => {
  it('installs packed tarballs outside the workspace and runs validate, build, and dev', async () => {
    const result = await runExternalInstall()
    expect(result.ok).toBe(true)
    expect(result.html).toContain('{{name}}')
    expect(result.html.includes('Ada')).toBe(false)
  }, 600_000)
})
