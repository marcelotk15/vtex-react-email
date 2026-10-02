import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { browserImportViolation, buildPreviewAssets, previewUiRoot } from './ui-build'

describe('preview interface bundle', () => {
  it('rejects node, compiler, and react-email imports', () => {
    expect(browserImportViolation('./client/preview-client')).toBeNull()
    expect(browserImportViolation('react')).toBeNull()
    expect(browserImportViolation('react-dom/client')).toBeNull()
    for (const specifier of [
      'node:fs',
      'fs',
      '@vtex-email/cli',
      '@vtex-email/react',
      '@react-email/components',
      'react-dom/server',
    ]) {
      expect(browserImportViolation(specifier)).toContain(specifier)
    }
  })

  it('refuses to bundle a browser entry that imports node', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-ui-'))
    const entry = path.join(root, 'main.tsx')
    await mkdir(path.join(root, 'styles'), { recursive: true })
    await writeFile(path.join(root, 'styles', 'app.css'), '@import "tailwindcss" source(none);\n')
    await writeFile(entry, `import 'node:fs'\nimport './styles/app.css'\n`)
    await expect(buildPreviewAssets(entry)).rejects.toThrow('node:fs')
  })

  it('builds the interface in memory with its own styles and fonts', async () => {
    const bundle = await buildPreviewAssets()
    expect(bundle.shell).toContain('<div id="root">')
    expect(bundle.shell.includes('Content-Security-Policy')).toBe(false)
    const script = [...bundle.files.keys()].find((file) => file.endsWith('.js'))
    const style = [...bundle.files.keys()].find((file) => file.endsWith('.css'))
    const font = [...bundle.files.keys()].find((file) => file.endsWith('.woff2'))
    expect(script).toContain('/assets/')
    expect(style).toBeTruthy()
    expect(font).toBeTruthy()
    const css = new TextDecoder().decode(bundle.files.get(style ?? '')?.body)
    expect(css).toContain('#f1f0ec')
    expect(css.toLowerCase()).toContain('ibm plex sans')
    expect(previewUiRoot().endsWith('ui')).toBe(true)
  })
})
