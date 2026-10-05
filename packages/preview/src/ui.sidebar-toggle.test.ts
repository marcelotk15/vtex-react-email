import { mkdtemp, cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { describe, expect, it } from 'vitest'

import { startPreview, type PreviewEndpoint } from './server/start-preview'

const example = path.resolve('examples/basic-store')

describe('sidebar toggle', () => {
  it('sidebar toggle restores width', async () => {
    const root = await mkdtemp(path.join(example, '.preview- '))
    const configPath = await copyStore(root)
    const port = await freePort()
    await writeFile(configPath, (await readFile(configPath, 'utf8')).replace('port: 3000', `port: ${port}`))
    let started: PreviewEndpoint | undefined
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    try {
      const preview = await startPreview({ configPath })
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
      await rm(root, { recursive: true, force: true })
    }
  }, 120_000)
})

async function copyStore(destination: string): Promise<string> {
  await mkdir(destination, { recursive: true })
  for (const name of ['emails', 'schemas', 'locales', 'fixtures', 'components']) {
    await cp(path.join(example, name), path.join(destination, name), { recursive: true })
  }
  await cp(path.join(example, 'vtex-email.config.ts'), path.join(destination, 'vtex-email.config.ts'))
  return path.join(destination, 'vtex-email.config.ts')
}

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
