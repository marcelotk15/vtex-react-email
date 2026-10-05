import { describe, expect, it } from 'vitest'

import { helpText, parseArgs } from './args'

describe('cli args', () => {
  it('parses help and version without a project', () => {
    expect(parseArgs(['node', 'vtex-email', '--help'])).toEqual({ kind: 'help' })
    expect(parseArgs(['node', 'vtex-email', '-V'])).toEqual({ kind: 'version' })
    expect(helpText()).toContain('vtex-email build')
    expect(helpText()).toContain('vtex-email dev')
  })

  it('rejects unknown commands and missing preview flags', () => {
    expect(parseArgs(['node', 'vtex-email', 'deploy'])).toMatchObject({
      kind: 'error',
      message: 'Unknown command: deploy',
    })
    expect(parseArgs(['node', 'vtex-email', 'preview', 'welcome'])).toMatchObject({
      kind: 'error',
      message: 'preview requires --fixture.',
    })
    expect(parseArgs(['node', 'vtex-email', '--unknown', '--format', 'json'])).toMatchObject({
      kind: 'error',
      format: 'json',
      message: 'Unknown option: --unknown',
    })
  })
})
