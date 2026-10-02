import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { commitArtifacts } from './write'

describe('artifact promotion', () => {
  it('keeps the previous file when a later name is invalid', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vtex email '))
    const target = path.join(directory, 'a.html')
    await writeFile(target, 'old', 'utf8')
    await expect(
      commitArtifacts(directory, [
        { name: 'a.html', content: 'new' },
        { name: '../b.html', content: 'x' },
      ]),
    ).rejects.toThrow(/Invalid artifact name/)
    expect(await readFile(target, 'utf8')).toBe('old')
    const names = await readdir(directory)
    expect(names).toEqual(['a.html'])
  })

  it('promotes a nested relative path', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vtex email '))
    await commitArtifacts(directory, [{ name: 'locales/pt-BR/note.html', content: 'ok' }])
    expect(await readFile(path.join(directory, 'locales', 'pt-BR', 'note.html'), 'utf8')).toBe('ok')
  })

  it('promotes a file whose directory name contains a space', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vtex email '))
    await commitArtifacts(directory, [{ name: 'note.html', content: 'line\r\n' }])
    expect(await readFile(path.join(directory, 'note.html'), 'utf8')).toBe('line\n')
  })
})
