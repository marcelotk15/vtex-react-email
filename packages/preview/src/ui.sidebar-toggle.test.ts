import { createSeedProject, removeTempDir } from '@vtex-email/test-harness'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { chromium } from 'playwright-core'
import { describe, expect, it } from 'vitest'

import { startPreview, type PreviewEndpoint } from './server/start-preview'

describe('sidebar toggle', () => {
  it('sidebar toggle restores width', async () => {
    const seed = await createSeedProject({ spaces: true })
    const port = await freePort()
    await writeFile(seed.configPath, (await readFile(seed.configPath, 'utf8')).replace('port: 3000', `port: ${port}`))
    let started: PreviewEndpoint | undefined
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    try {
      const preview = await startPreview({ configPath: seed.configPath })
      if (!preview.ok) throw new Error(JSON.stringify(preview.diagnostics))
      started = preview
      await page.goto(preview.url)
      await page.getByText('Updated').waitFor()
      const width = () => page.locator('#navigation').evaluate((node) => node.getBoundingClientRect().width)
      expect(await width()).toBeGreaterThan(200)
      await page.getByRole('button', { name: 'Collapse navigation' }).click()
      await expect.poll(width).toBe(0)
      await page.getByRole('button', { name: 'Open navigation' }).click()
      await expect.poll(width).toBeGreaterThanOrEqual(240)
      await page.getByRole('tree', { name: 'Emails' }).waitFor()
    } finally {
      await browser.close()
      await started?.close()
      await removeTempDir(seed.root)
    }
  }, 120_000)
})

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}
