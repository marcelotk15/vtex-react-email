import type { ZodType } from 'zod'

import { checkFixture, errorDiagnostic, type Diagnostic } from '@vtex-email/core'
import { glob, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { FixtureMeta, LoadedFixture } from './types'

export async function readFixtures(
  configDir: string,
  emailId: string,
  pattern: string,
  diagnostics: Diagnostic[],
): Promise<LoadedFixture[]> {
  const fixtures: LoadedFixture[] = []
  for await (const entry of glob(pattern, { cwd: configDir })) {
    if (entry.endsWith('.meta.json')) continue
    const file = path.resolve(configDir, entry)
    const id = path.basename(entry, '.json')
    const metaFile = file.replace(/\.json$/i, '.meta.json')
    try {
      const data: unknown = JSON.parse(await readFile(file, 'utf8'))
      const meta = parseMeta(JSON.parse(await readFile(metaFile, 'utf8')))
      if (!meta) {
        diagnostics.push(
          errorDiagnostic('CFG001', `Fixture ${id} has an invalid sidecar.`, { templateId: emailId, fixtureId: id }),
        )
        continue
      }
      fixtures.push({ id, file, data, meta, negative: meta.expect === 'invalid' })
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to read fixture ${id}.`
      diagnostics.push(errorDiagnostic('CFG001', message, { templateId: emailId, fixtureId: id }))
    }
  }
  return fixtures.sort((left, right) => left.id.localeCompare(right.id))
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
