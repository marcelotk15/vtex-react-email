import type { ZodType } from 'zod'

import { checkFixture, errorDiagnostic, type Diagnostic } from '@vtex-email/core'
import { parse as parseJsonc, printParseErrorCode, type ParseError } from 'jsonc-parser'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { FixtureMeta, LoadedFixture } from './types'

const PAYLOAD_EXTENSIONS = ['.json', '.jsonc'] as const

export async function readFixtures(
  configDir: string,
  emailId: string,
  fixturesRelative: string,
  diagnostics: Diagnostic[],
): Promise<LoadedFixture[]> {
  const directory = path.resolve(configDir, fixturesRelative)
  if (!(await exists(directory))) {
    diagnostics.push(
      errorDiagnostic('CFG001', `Fixtures directory not found: ${toPosix(fixturesRelative)}`, {
        templateId: emailId,
        source: { file: directory },
      }),
    )
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true })
  const payloads = entries.filter((entry) => entry.isFile() && isPayloadFile(entry.name))
  const byId = new Map<string, string[]>()
  for (const entry of payloads) {
    const id = fixtureIdFromName(entry.name)
    if (!id) continue
    const list = byId.get(id) ?? []
    list.push(entry.name)
    byId.set(id, list)
  }

  const fixtures: LoadedFixture[] = []
  for (const [id, names] of [...byId.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    if (names.length > 1) {
      diagnostics.push(
        errorDiagnostic(
          'CFG001',
          `Fixture id "${id}" collides between ${names.sort().join(' and ')}. Keep only one of .json or .jsonc.`,
          { templateId: emailId, fixtureId: id, source: { file: directory } },
        ),
      )
      continue
    }
    const name = names[0]!
    const file = path.join(directory, name)
    const metaFile = path.join(directory, `${id}.meta.json`)
    const parsed = await parseFixtureFile(file)
    if (!parsed.ok) {
      diagnostics.push({
        ...parsed.diagnostic,
        templateId: emailId,
        fixtureId: id,
      })
      continue
    }
    let metaRaw: unknown
    try {
      metaRaw = JSON.parse(await readFile(metaFile, 'utf8'))
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to read fixture meta ${id}.`
      diagnostics.push(
        errorDiagnostic('CFG001', message, {
          templateId: emailId,
          fixtureId: id,
          source: { file: metaFile },
        }),
      )
      continue
    }
    const meta = parseMeta(metaRaw)
    if (!meta) {
      diagnostics.push(
        errorDiagnostic('CFG001', `Fixture ${id} has an invalid sidecar.`, {
          templateId: emailId,
          fixtureId: id,
          source: { file: metaFile },
        }),
      )
      continue
    }
    fixtures.push({ id, file, data: parsed.data, meta, negative: meta.expect === 'invalid' })
  }
  return fixtures
}

export function checkLoadedFixtures(
  emailId: string,
  schema: ZodType,
  fixtures: readonly LoadedFixture[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const fixture of fixtures) {
    const issue = checkFixture(schema, fixture.data)
    if (fixture.negative) {
      if (!issue) {
        diagnostics.push(
          errorDiagnostic('DATA001', `Negative fixture ${fixture.id} was accepted by the schema.`, {
            templateId: emailId,
            fixtureId: fixture.id,
            origin: fixture.meta.origin,
          }),
        )
      }
      continue
    }
    if (issue) {
      diagnostics.push({ ...issue, templateId: emailId, fixtureId: fixture.id, origin: fixture.meta.origin })
    }
  }
  return diagnostics
}

export function isPayloadFile(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower.endsWith('.meta.json') || lower.endsWith('.meta.jsonc')) return false
  return PAYLOAD_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

export function fixtureIdFromName(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.meta.json') || lower.endsWith('.meta.jsonc')) return null
  if (lower.endsWith('.jsonc')) return name.slice(0, -'.jsonc'.length)
  if (lower.endsWith('.json')) return name.slice(0, -'.json'.length)
  return null
}

async function parseFixtureFile(
  file: string,
): Promise<{ ok: true; data: unknown } | { ok: false; diagnostic: Diagnostic }> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read fixture.'
    return { ok: false, diagnostic: errorDiagnostic('CFG001', message, { source: { file } }) }
  }
  if (file.toLowerCase().endsWith('.jsonc')) {
    const errors: ParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false })
    if (errors.length > 0) {
      const first = errors[0]!
      const position = offsetToPosition(text, first.offset)
      return {
        ok: false,
        diagnostic: errorDiagnostic('CFG001', `Invalid JSONC: ${printParseErrorCode(first.error)}`, {
          source: { file, line: position.line, column: position.column },
        }),
      }
    }
    return { ok: true, data }
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.'
    const position = jsonErrorPosition(message, text)
    return {
      ok: false,
      diagnostic: errorDiagnostic('CFG001', message, {
        source: { file, ...position },
      }),
    }
  }
}

function parseMeta(value: unknown): FixtureMeta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const allowed = new Set(['description', 'origin', 'event', 'purpose', 'expectedLocale', 'expect'])
  if (Object.keys(record).some((key) => !allowed.has(key))) return null
  if (
    typeof record.description !== 'string' ||
    typeof record.origin !== 'string' ||
    typeof record.event !== 'string' ||
    typeof record.purpose !== 'string'
  ) {
    return null
  }
  if (record.expectedLocale !== undefined && typeof record.expectedLocale !== 'string') return null
  const expect = record.expect ?? 'valid'
  if (expect !== 'valid' && expect !== 'invalid') return null
  return {
    description: record.description,
    origin: record.origin,
    event: record.event,
    purpose: record.purpose,
    expect,
    ...(typeof record.expectedLocale === 'string' ? { expectedLocale: record.expectedLocale } : {}),
  }
}

function offsetToPosition(text: string, offset: number): { line: number; column: number } {
  let line = 1
  let column = 1
  const end = Math.min(offset, text.length)
  for (let index = 0; index < end; index += 1) {
    if (text[index] === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }
  return { line, column }
}

function jsonErrorPosition(message: string, text: string): { line: number; column: number } | null {
  const match = /position\s+(\d+)/i.exec(message)
  if (!match) return null
  return offsetToPosition(text, Number(match[1]))
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/')
}
