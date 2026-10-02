import type { BuiltEmail, PreviewResult, ProjectResult } from '@vtex-email/cli'

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { SessionPaths } from './change-plan'

import { createPreviewSession, type PreviewServices } from './session'

describe('preview session', () => {
  it('keeps the Handlebars source when the fixture changes and can force a locale', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-session-'))
    const email = fakeEmail(root, 'order', ['one', 'two'])
    const seen: Array<{ fixtureId: string; mode: string; locale?: string }> = []
    const session = createPreviewSession({
      paths: paths(root),
      emails: [email],
      diagnostics: [],
      ok: true,
      services: services({
        evaluate: (input) => {
          seen.push({ fixtureId: input.fixtureId, mode: input.mode, locale: input.locale })
          return evaluated(input.fixtureId === 'one' ? 'Hello' : 'Olá', 'SOURCE')
        },
      }),
    })
    await session.open()
    await session.select({ fixtureId: 'two' })
    expect(session.state().html).toBe('Olá')
    expect(session.state().source).toBe('SOURCE')
    await session.select({ mode: 'forced', forcedLocale: 'pt-BR' })
    expect(session.state().selection.mode).toBe('forced')
    expect(session.state().selection.forcedLocale).toBe('pt-BR')
    expect(seen.at(-1)).toMatchObject({ mode: 'forced', locale: 'pt-BR' })
    expect(session.state().data).toEqual({ locale: 'en-US' })
    expect(session.state().project.name).toBe(path.basename(root))
    expect(session.state().emails.find((item) => item.id === 'order')).toMatchObject({
      localePath: 'locale',
      fixtures: [
        expect.objectContaining({ id: 'one', file: 'fixtures/order/one.json', origin: 'synthetic', purpose: 'test' }),
        expect.objectContaining({ id: 'two', file: 'fixtures/order/two.json', expectedLocale: 'en-US' }),
      ],
    })
    await rm(root, { recursive: true, force: true })
  })

  it('revalidates a fixture without compiling and recompiles shared dependents', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-session-'))
    const shared = path.join(root, 'components', 'shared.tsx')
    const alpha = fakeEmail(root, 'alpha', ['one'], [shared])
    const beta = fakeEmail(root, 'beta', ['one'], [shared])
    let compiled: Array<readonly string[] | null> = []
    let refreshed = 0
    const session = createPreviewSession({
      paths: paths(root),
      emails: [alpha, beta],
      diagnostics: [],
      ok: true,
      services: services({
        compile: async (emailIds) => {
          compiled.push(emailIds)
          return okResult([alpha, beta])
        },
        refreshFixtures: async (email) => {
          refreshed += 1
          return email
        },
      }),
    })
    await session.open()
    compiled = []
    const fixture = path.join(root, 'fixtures', 'alpha', 'one.json')
    await session.ingest([fixture])
    expect(compiled).toEqual([])
    expect(refreshed).toBe(1)

    await session.ingest([shared])
    expect(compiled).toEqual([['alpha', 'beta']])
    await rm(root, { recursive: true, force: true })
  })

  it('keeps the last html when compilation fails and drops an older result', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-session-'))
    const shared = path.join(root, 'components', 'shared.tsx')
    const email = fakeEmail(root, 'alpha', ['one'], [shared])
    const pending: Array<(result: ProjectResult) => void> = []
    const session = createPreviewSession({
      paths: paths(root),
      emails: [email],
      diagnostics: [],
      ok: true,
      services: services({
        compile: () => new Promise((resolve) => pending.push(resolve)),
        evaluate: (input) => evaluated(input.email.files[0]?.content ?? '', 'SOURCE'),
      }),
    })
    await session.open()
    expect(session.state().html).toBe('<p>alpha</p>')

    const first = session.ingest([shared])
    const second = session.ingest([shared])
    const resolveSecond = pending[1]
    const resolveFirst = pending[0]
    if (!resolveFirst || !resolveSecond) throw new Error('Both compiles should be in flight.')
    resolveSecond(okResult([withContent(email, 'newer')]))
    await second
    expect(session.state().html).toBe('newer')
    expect(session.state().status).toBe('ready')
    resolveFirst(okResult([withContent(email, 'older')]))
    await first
    expect(session.state().html).toBe('newer')

    const failed = createPreviewSession({
      paths: paths(root),
      emails: [email],
      diagnostics: [],
      ok: true,
      services: services({
        compile: async () => ({
          ok: false,
          exitCode: 1,
          diagnostics: [{ code: 'HBS001', severity: 'error', message: 'broken' }],
          manifest: null,
          emails: [],
          wrote: [],
          preserved: [],
        }),
        evaluate: (input) => evaluated(input.email.files[0]?.content ?? '', 'SOURCE'),
      }),
    })
    await failed.open()
    await failed.ingest([shared])
    expect(failed.state().status).toBe('stale')
    expect(failed.state().html).toBe('<p>alpha</p>')
    expect(failed.state().diagnostics.some((item) => item.message === 'broken')).toBe(true)
    await rm(root, { recursive: true, force: true })
  })

  it('updates the list when an email or fixture is created or removed', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-session-'))
    const emailsDir = path.join(root, 'emails')
    await mkdir(emailsDir, { recursive: true })
    const entry = path.join(emailsDir, 'alpha.email.tsx')
    await writeFile(entry, 'export {}\n')
    const alpha = fakeEmail(root, 'alpha', ['one'])
    alpha.file = entry
    let catalog = [alpha]
    const session = createPreviewSession({
      paths: paths(root, emailsDir),
      emails: [alpha],
      diagnostics: [],
      ok: true,
      services: services({
        compile: async () => okResult(catalog),
        refreshFixtures: async (email) => ({
          ...email,
          fixtures: email.fixtures.filter((fixture) => fixture.id !== 'one'),
        }),
      }),
    })
    await session.open()
    const created = fakeEmail(root, 'beta', ['one'])
    catalog = [alpha, created]
    await session.ingest([path.join(emailsDir, 'beta.email.tsx')])
    expect(session.state().emails.map((email) => email.id)).toEqual(['alpha', 'beta'])

    catalog = [created]
    await rm(entry)
    await session.ingest([entry])
    expect(session.state().emails.map((email) => email.id)).toEqual(['beta'])

    const fixture = path.join(root, 'fixtures', 'beta', 'one.json')
    await session.ingest([fixture])
    expect(session.state().emails[0]?.fixtures).toEqual([])
    await rm(root, { recursive: true, force: true })
  })

  it('removes an email from the compiler list without reading the message text', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vtex-session-'))
    const shared = path.join(root, 'shared.tsx')
    await writeFile(shared, 'export {}\n')
    const alpha = fakeEmail(root, 'alpha', ['one'], [shared])
    const session = createPreviewSession({
      paths: paths(root),
      emails: [alpha],
      diagnostics: [],
      ok: true,
      services: services({
        compile: async () => ({
          ok: true,
          exitCode: 0,
          diagnostics: [{ code: 'CFG001', severity: 'error', message: 'gone' }],
          removedEmailIds: ['alpha'],
          manifest: null,
          emails: [],
          wrote: [],
          preserved: [],
        }),
      }),
    })
    await session.open()
    await session.ingest([shared])
    expect(session.state().emails.map((email) => email.id)).toEqual([])
    await rm(root, { recursive: true, force: true })
  })
})

function paths(root: string, emailsDir = path.join(root, 'emails')): SessionPaths {
  return {
    configDir: root,
    configFile: path.join(root, 'vtex-email.config.ts'),
    profilePath: path.join(root, 'vtex-target.ts'),
    catalogFiles: [path.join(root, 'locales', 'pt-BR.json')],
    emailRoots: [emailsDir],
  }
}

function services(overrides: Partial<PreviewServices>): PreviewServices {
  return {
    compile: async () => okResult([]),
    refreshFixtures: async (email) => email,
    evaluate: () => evaluated('html', 'source'),
    ...overrides,
  }
}

function fakeEmail(root: string, id: string, fixtureIds: string[], dependencies: string[] = []): BuiltEmail {
  return {
    id,
    event: id,
    output: 'merged',
    locales: ['pt-BR', 'en-US'],
    defaultLocale: 'pt-BR',
    localePath: 'locale',
    files: [{ name: `${id}.html`, content: `<p>${id}</p>`, sha256: id, role: 'merged' }],
    diagnostics: [],
    structure: [],
    dependencies,
    fixtures: fixtureIds.map((fixtureId) => ({
      id: fixtureId,
      file: path.join(root, 'fixtures', id, `${fixtureId}.json`),
      data: { locale: 'en-US' },
      meta: {
        description: fixtureId,
        origin: 'synthetic',
        event: id,
        purpose: 'test',
        expect: 'valid',
        expectedLocale: 'en-US',
      },
      negative: false,
    })),
    fixturesPattern: `fixtures/${id}/*.json`,
    file: path.join(root, 'emails', `${id}.email.tsx`),
    schema: {} as BuiltEmail['schema'],
    manifest: null,
    profile: { emission: { id: 'test', allowParentSegments: true, capabilities: [] }, simulator: { helpers: [] } },
    warnRenderedBytes: 90_000,
  }
}

function withContent(email: BuiltEmail, content: string): BuiltEmail {
  const file = email.files[0]
  if (!file) return email
  return { ...email, files: [{ ...file, content }] }
}

function evaluated(html: string, source: string): PreviewResult {
  return {
    ok: true,
    exitCode: 0,
    html,
    source,
    diagnostics: [],
    selector: true,
    locale: 'en-US',
    payloadLocale: 'en-US',
  }
}

function okResult(emails: BuiltEmail[]): ProjectResult {
  return { ok: true, exitCode: 0, diagnostics: [], manifest: null, emails, wrote: [], preserved: [] }
}
