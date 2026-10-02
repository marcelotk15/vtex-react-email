import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { commitArtifacts } from './commit'

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

  it('removes an obsolete file in the same promotion as the replacement', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vtex email '))
    const kept = path.join(directory, 'a.html')
    const obsolete = path.join(directory, 'obsolete.html')
    await writeFile(kept, 'old', 'utf8')
    await writeFile(obsolete, 'gone', 'utf8')
    await commitArtifacts(directory, [{ name: 'a.html', content: 'new' }], ['obsolete.html'])
    expect(await readFile(kept, 'utf8')).toBe('new')
    await expect(readFile(obsolete, 'utf8')).rejects.toThrow()
  })

  it('restores a removed file when a later promotion fails', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vtex email '))
    const kept = path.join(directory, 'a.html')
    const obsolete = path.join(directory, 'obsolete.html')
    await writeFile(kept, 'old', 'utf8')
    await writeFile(obsolete, 'gone', 'utf8')
    await expect(
      commitArtifacts(
        directory,
        [
          { name: 'a.html', content: 'new' },
          { name: '../b.html', content: 'x' },
        ],
        ['obsolete.html'],
      ),
    ).rejects.toThrow(/Invalid artifact name/)
    expect(await readFile(kept, 'utf8')).toBe('old')
    expect(await readFile(obsolete, 'utf8')).toBe('gone')
  })
})
