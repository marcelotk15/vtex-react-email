import type { BuiltEmail, ProjectManifest } from './types'

export function projectManifest(profileId: string, emails: BuiltEmail[]): ProjectManifest {
  return {
    formatVersion: 1,
    profileId,
    homologation: 'experimental',
    emails: emails.map((email) => ({
      id: email.id,
      event: email.event,
      output: email.output,
      locales: email.locales,
      defaultLocale: email.defaultLocale,
      files: email.files.map((file) => ({
        name: file.name,
        sha256: file.sha256,
        role: file.role,
        ...(file.locale ? { locale: file.locale } : {}),
      })),
      capabilities: email.manifest?.capabilities.map((item) => ({ name: item.name, evidence: item.evidence })) ?? [],
      warnings: email.diagnostics.filter((item) => item.severity === 'warning').map((item) => item.message),
    })),
  }
}

export function localeInventory(
  previous: ProjectManifest | null,
  current: ProjectManifest,
  locale: string,
): ProjectManifest['emails'] {
  const prior = new Map((previous?.emails ?? []).map((email) => [email.id, email]))
  const seen = new Set<string>()
  const emails: ProjectManifest['emails'] = []
  for (const email of current.emails) {
    seen.add(email.id)
    const old = prior.get(email.id)
    const replacement = email.files.filter((file) => file.role === 'locale' && file.locale === locale)
    const kept = (old?.files ?? []).filter((file) => !(file.role === 'locale' && file.locale === locale))
    const files = [...kept, ...replacement]
    const hasMerged = files.some((file) => file.role === 'merged')
    emails.push({
      ...email,
      files,
      capabilities: mergeCapabilities(old?.capabilities ?? [], email.capabilities, hasMerged),
    })
  }
  for (const email of prior.values()) {
    if (!seen.has(email.id)) emails.push(email)
  }
  return emails
}

function mergeCapabilities(
  previous: ReadonlyArray<{ name: string; evidence: string }>,
  incoming: ReadonlyArray<{ name: string; evidence: string }>,
  hasMerged: boolean,
): Array<{ name: string; evidence: string }> {
  const map = new Map<string, { name: string; evidence: string }>()
  for (const item of [...previous, ...incoming]) {
    if (item.name === 'eq' && !hasMerged) continue
    map.set(item.name, item)
  }
  return [...map.values()]
}
