import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { releaseArtifacts } from '../output/commit'
import { validateHandlebarsSyntax } from './syntax'

const helpers = ['each', 'if', 'unless', 'formatCurrency']

describe('Handlebars syntax gate', () => {
  it('rejects an unclosed block and a mismatched block', () => {
    expect(validateHandlebarsSyntax('{{#each items}}', helpers)?.code).toBe('HBS001')
    expect(validateHandlebarsSyntax('{{#each items}}{{/if}}', helpers)?.code).toBe('HBS001')
  })

  it('rejects an unknown helper without executing it', () => {
    const issue = validateHandlebarsSyntax('{{mystery price}}', helpers)
    expect(issue?.code).toBe('HBS002')
  })

  it('accepts a balanced template', () => {
    const source = '{{#each items}}{{#if name}}{{name}}{{else}}empty{{/if}}{{/each}}'
    expect(validateHandlebarsSyntax(source, helpers)).toBeNull()
  })

  it('keeps the previous file and does not evaluate a malformed template', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vtex email '))
    const target = path.join(directory, 'keep.html')
    await writeFile(target, 'previous', 'utf8')
    const evaluated: string[] = []
    const issue = await releaseArtifacts({
      helperNames: helpers,
      directory,
      files: [{ name: 'keep.html', content: '{{#each items}}' }],
    })
    expect(issue?.code).toBe('HBS001')
    expect(await readFile(target, 'utf8')).toBe('previous')
    if (issue === null) evaluated.push('ran')
    expect(evaluated).toEqual([])
  })
})
