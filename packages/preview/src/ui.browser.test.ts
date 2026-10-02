import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium, type Page } from 'playwright-core'
import { describe, expect, it } from 'vitest'

import { startPreview, type PreviewEndpoint } from './server/start-preview'
import { prefsKey } from './ui/prefs/prefs'

const example = path.resolve('examples/basic-store')
describe('preview workbench', () => {
  it('supports the daily inspection flow and keeps the iframe stable', async () => {
    const root = await mkdtemp(path.join(example, '.preview- '))
    const shots = await mkdtemp(path.join(tmpdir(), 'vtex-preview-ui-'))
    const configPath = await copyStore(root)
    const port = await freePort()
    await writeFile(configPath, (await readFile(configPath, 'utf8')).replace('port: 3000', `port: ${port}`))
    let started: PreviewEndpoint | undefined
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    })
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const eventRequests: string[] = []
    let iframeLoads = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/events') eventRequests.push(request.url())
    })
    page.on('framenavigated', (frame) => {
      if (frame.parentFrame()) iframeLoads += 1
    })

    try {
      const preview = await startPreview({ configPath })
      if (!preview.ok) throw new Error(JSON.stringify(preview.diagnostics))
      started = preview
      await page.goto(preview.url)
      await page.getByText('Atualizado').waitFor()
      expect(eventRequests).toHaveLength(1)
      const project = path.basename(root)
      await expectText(page.getByText(project))

      const tree = page.getByRole('tree', { name: 'Emails' })
      await tree.getByRole('treeitem', { name: 'order-confirmed' }).click()
      await tree.getByRole('treeitem', { name: 'delivery' }).click()
      const frame = page.frameLocator('[data-testid="email-frame"]')
      await frame.getByText('Hello,').waitFor()
      const deliveryBox = await page.getByTestId('email-frame').boundingBox()
      expect(deliveryBox?.width).toBe(600)

      const search = page.getByRole('textbox', { name: 'Buscar email ou fixture' })
      await search.fill('pickup')
      await page.getByText('Nenhum resultado para “pickup”.').waitFor()
      await page.screenshot({ path: path.join(shots, '1280-empty.png'), fullPage: false })
      await search.press('Escape')
      await search.fill('address')
      await tree.getByRole('treeitem', { name: 'delivery' }).waitFor()
      await expectMissing(tree.getByRole('treeitem', { name: 'auth-code' }))
      await search.fill('')
      await tree.getByRole('treeitem', { name: 'auth-code' }).waitFor()

      await page.getByRole('tab', { name: 'Handlebars' }).click()
      const source = page.locator('pre')
      await source.waitFor()
      const before = normalizeSource(await source.innerText())
      const beforeLoads = iframeLoads
      await page.getByRole('tab', { name: 'Dados' }).click()
      await page.getByRole('tab', { name: 'Diagnósticos' }).click()
      await page.getByRole('button', { name: 'Recolher inspetor' }).click()
      await expectMissing(page.getByRole('tab', { name: 'Handlebars' }))
      await page.getByRole('button', { name: 'Abrir inspetor' }).click()
      await page.getByRole('tab', { name: 'Handlebars' }).waitFor()
      expect(iframeLoads).toBe(beforeLoads)

      await tree.getByRole('treeitem', { name: 'missing-locale' }).click()
      await frame.getByText('Olá,').waitFor()
      expect(iframeLoads).toBe(beforeLoads + 1)
      await page.getByRole('tab', { name: 'Handlebars' }).click()
      expect(normalizeSource(await source.innerText())).toBe(before)

      await page.getByLabel('Locale').click()
      await page.getByRole('option', { name: 'pt-BR' }).click()
      await page.getByRole('tab', { name: 'Dados' }).click()
      await page.getByText('orders.0.clientPreferencesData.locale = pt-BR só na cópia avaliada.').waitFor()
      await page.screenshot({ path: path.join(shots, '1280-forced.png'), fullPage: false })
      const fixtureFile = path.join(root, 'fixtures', 'order-confirmed', 'delivery.json')
      const missingFile = path.join(root, 'fixtures', 'order-confirmed', 'missing-locale.json')
      expect(await readFile(missingFile, 'utf8')).not.toContain('Content-Security-Policy')

      await page.getByRole('button', { name: 'Mobile' }).click()
      await page.getByText('375 × 667').waitFor()
      expect((await page.getByTestId('email-frame').boundingBox())?.width).toBe(375)
      await page.screenshot({ path: path.join(shots, '1280-mobile.png'), fullPage: false })
      await page.getByRole('button', { name: 'Desktop' }).click()
      await page.getByText(/^600 ×/).waitFor()
      await page.getByRole('button', { name: 'Largo' }).click()
      expect((await page.getByTestId('email-frame').boundingBox())?.width).toBe(1024)

      const navigation = page.getByRole('button', { name: 'Recolher navegação' })
      await navigation.click()
      await expectMissing(page.getByText(project))
      await page.getByRole('button', { name: 'Abrir navegação' }).click()
      await page.getByText(project).waitFor()

      await page.keyboard.press('Control+K')
      await expect.poll(() => page.evaluate('document.activeElement && document.activeElement.id')).toBe('email-search')
      await page.getByRole('treeitem', { name: 'order-confirmed' }).focus()
      await page.keyboard.press('ArrowDown')
      await expect
        .poll(() => page.evaluate('document.activeElement && document.activeElement.getAttribute("data-row")'))
        .toContain('fixture:')

      await page.getByRole('button', { name: 'Bloquear imagens remotas' }).click()
      await page.getByText('Imagens remotas bloqueadas nesta visualização. O template não foi alterado.').waitFor()
      const blockedDoc = await frameDocument(page)
      expect(blockedDoc).toContain("img-src 'none'")
      expect(await readFile(fixtureFile, 'utf8')).not.toContain('Content-Security-Policy')
      const emailFile = path.join(root, 'emails', 'order-confirmed.email.tsx')
      const originalEmail = await readFile(emailFile, 'utf8')
      await writeFile(
        emailFile,
        originalEmail
          .replace('import { Section, Text }', 'import { Img, Section, Text }')
          .replace(
            '<Email className="m-0 bg-white font-sans">',
            '<Email className="m-0 bg-white font-sans"><Img alt="Camisa" height="12" src="https://cdn.example/shirt.png" width="12" />',
          ),
      )
      await frame.getByRole('img', { name: 'Camisa' }).waitFor({ timeout: 20_000 })
      const blockedWithImage = await frameDocument(page)
      expect(blockedWithImage).toContain("img-src 'none'")
      expect(blockedWithImage).toContain('https://cdn.example/shirt.png')
      await page.getByRole('button', { name: 'Mostrar imagens remotas' }).click()
      await expect
        .poll(() => frameDocument(page).then((value) => value.includes('Content-Security-Policy')))
        .toBe(false)
      await page.getByRole('button', { name: 'Bloquear imagens remotas' }).click()
      await expect.poll(() => frameDocument(page).then((value) => value.includes("img-src 'none'"))).toBe(true)
      expect(await readFile(emailFile, 'utf8')).not.toContain('Content-Security-Policy')

      await writeFile(emailFile, originalEmail.replace('export function', 'export function <<<'))
      await page.getByText('Desatualizado').waitFor({ timeout: 20_000 })
      await frame.getByRole('img', { name: 'Camisa' }).waitFor()
      await page.getByRole('tab', { name: /^Diagnósticos/ }).click()
      await page.getByText(/erro/i).first().waitFor()
      await page.screenshot({ path: path.join(shots, '1280-stale.png'), fullPage: false })
      await writeFile(emailFile, originalEmail)
      await page.getByText('Atualizado').waitFor({ timeout: 20_000 })
      await frame.getByText('Olá,').waitFor()

      await page.getByRole('tab', { name: 'Handlebars' }).click()
      await page.getByRole('button', { name: 'Copiar' }).click()
      await page.getByRole('button', { name: 'Copiado' }).waitFor()
      const stored = await page.evaluate(`window.localStorage.getItem(${JSON.stringify(prefsKey)})`)
      expect(stored).toContain('"tab":"source"')
      expect(stored ?? '').not.toContain('Ada')
      expect(stored ?? '').not.toContain('AUTH-KEEP')
      expect(eventRequests).toHaveLength(1)

      await page.context().setOffline(true)
      await page.getByText('Desconectado').waitFor()
      await page.context().setOffline(false)
      await page.getByText('Atualizado').waitFor({ timeout: 15_000 })

      await page.getByRole('button', { name: 'Desktop' }).click()
      await page.getByRole('button', { name: 'Mostrar imagens remotas' }).click()
      await page.getByLabel('Locale').click()
      await page.getByRole('option', { name: 'Locale da fixture' }).click()
      await tree.getByRole('treeitem', { name: 'delivery' }).click()
      await frame.getByText('Hello,').waitFor()
      await page.getByRole('button', { name: 'Copiar', exact: true }).waitFor()
      await page.screenshot({ path: path.join(shots, '1280.png'), fullPage: false })
      await page.setViewportSize({ width: 1536, height: 960 })
      await page.screenshot({ path: path.join(shots, '1536.png'), fullPage: false })
      await page.getByRole('tab', { name: 'Dados' }).click()
      await page.screenshot({ path: path.join(shots, '1536-data.png'), fullPage: false })
      await page.getByRole('tab', { name: /^Diagnósticos/ }).click()
      await page.screenshot({ path: path.join(shots, '1536-diagnostics.png'), fullPage: false })
      await page.setViewportSize({ width: 1024, height: 768 })
      await page.getByRole('button', { name: 'Abrir navegação' }).waitFor()
      await page.screenshot({ path: path.join(shots, '1024.png'), fullPage: false })
      console.log(`PREVIEW_SCREENSHOTS ${shots}`)
      expect(digest(await readFile(path.join(shots, '1280.png')))).not.toBe(
        digest(await readFile(path.join(shots, '1024.png'))),
      )
    } finally {
      await browser.close()
      await started?.close()
      await rm(root, { recursive: true, force: true })
    }
  }, 240_000)
})

async function copyStore(destination: string): Promise<string> {
  await mkdir(destination, { recursive: true })
  for (const name of ['emails', 'schemas', 'locales', 'fixtures']) {
    await cp(path.join(example, name), path.join(destination, name), { recursive: true })
  }
  await cp(path.join(example, 'vtex-target.ts'), path.join(destination, 'vtex-target.ts'))
  await cp(path.join(example, 'vtex-email.config.ts'), path.join(destination, 'vtex-email.config.ts'))
  return path.join(destination, 'vtex-email.config.ts')
}

async function frameDocument(page: Page): Promise<string> {
  const value = await page.getByTestId('email-frame').evaluate((node) => Reflect.get(node, 'srcdoc'))
  if (typeof value !== 'string') throw new Error('The email frame has no document.')
  return value
}

function digest(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeSource(value: string): string {
  return value
    .split('\n')
    .map((line) => line.replace(/^\s*\d+\s/, ''))
    .join('\n')
    .trim()
}

function expectText(locator: ReturnType<Page['getByText']>): Promise<void> {
  return locator.waitFor().then(() => undefined)
}

async function expectMissing(locator: ReturnType<Page['getByText']>): Promise<void> {
  await expect.poll(async () => locator.isVisible()).toBe(false)
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
