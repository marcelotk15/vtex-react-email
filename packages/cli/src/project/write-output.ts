import { releaseArtifacts, type Diagnostic } from '@vtex-email/core'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { BuiltEmail, ProjectManifest } from './types'

import { localeInventory } from './manifest'

export async function writeOutput(
  outDir: string,
  manifest: ProjectManifest,
  emails: BuiltEmail[],
  onlyId: string | undefined,
  helperNames: readonly string[],
  locale: string | undefined,
): Promise<
  { ok: true; manifest: ProjectManifest; wrote: string[]; preserved: string[] } | { ok: false; diagnostic: Diagnostic }
> {
  const manifestPath = path.join(outDir, 'manifest.json')
  const previous = await readManifest(manifestPath)
  const nextEmails = locale
    ? localeInventory(previous, manifest, locale)
    : onlyId && previous
      ? [...previous.emails.filter((item) => item.id !== onlyId), ...manifest.emails]
      : manifest.emails
  const next: ProjectManifest = {
    formatVersion: 1,
    profileId: manifest.profileId,
    homologation: 'experimental',
    emails: nextEmails.sort((left, right) => left.id.localeCompare(right.id)),
  }
  const selected = new Set(emails.map((email) => email.id))
  const replacements = emails.flatMap((email) =>
    email.files.filter((file) => !locale || (file.role === 'locale' && file.locale === locale)),
  )
  const kept = new Set(next.emails.flatMap((email) => email.files.map((file) => file.name)))
  const obsolete: string[] = []
  for (const email of previous?.emails ?? []) {
    if (onlyId && email.id !== onlyId) continue
    if (locale && !selected.has(email.id)) continue
    for (const file of email.files) {
      if (!kept.has(file.name)) obsolete.push(file.name)
    }
  }
  const issue = await releaseArtifacts({
    helperNames,
    directory: outDir,
    files: [
      ...replacements.map((file) => ({ name: file.name, content: file.content })),
      { name: 'manifest.json', content: `${JSON.stringify(next, null, 2)}\n` },
    ],
    remove: obsolete,
  })
  if (issue) return { ok: false, diagnostic: issue }
  const wroteNames = new Set(replacements.map((file) => file.name))
  const preserved = next.emails
    .flatMap((email) => email.files.map((file) => file.name))
    .filter((name) => !wroteNames.has(name))
  return { ok: true, manifest: next, wrote: [...wroteNames, 'manifest.json'], preserved }
}

async function readManifest(file: string): Promise<ProjectManifest | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as ProjectManifest
    if (parsed.formatVersion !== 1 || !Array.isArray(parsed.emails)) return null
    return parsed
  } catch {
    return null
  }
}
