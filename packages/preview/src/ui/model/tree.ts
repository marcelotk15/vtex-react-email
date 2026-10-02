import type { PreviewEmail } from '../../contract'

export function filterEmails(emails: readonly PreviewEmail[], query: string): PreviewEmail[] {
  const term = query.trim().toLocaleLowerCase()
  if (term.length === 0) return [...emails]
  const matched: PreviewEmail[] = []
  for (const email of emails) {
    if (email.id.toLocaleLowerCase().includes(term)) {
      matched.push(email)
      continue
    }
    const fixtures = email.fixtures.filter(
      (fixture) =>
        fixture.id.toLocaleLowerCase().includes(term) || fixture.description.toLocaleLowerCase().includes(term),
    )
    if (fixtures.length > 0) matched.push({ ...email, fixtures })
  }
  return matched
}

export interface TreeRow {
  id: string
  kind: 'email' | 'fixture'
  emailId: string
  fixtureId: string
  label: string
  description: string
  expectedLocale?: string
  depth: 0 | 1
  expanded: boolean
}

export function visibleRows(emails: readonly PreviewEmail[], query: string, expanded: ReadonlySet<string>): TreeRow[] {
  const searching = query.trim().length > 0
  const rows: TreeRow[] = []
  for (const email of filterEmails(emails, query)) {
    const open = searching || expanded.has(email.id)
    rows.push({
      id: `email:${email.id}`,
      kind: 'email',
      emailId: email.id,
      fixtureId: '',
      label: email.id,
      description: '',
      depth: 0,
      expanded: open,
    })
    if (!open) continue
    for (const fixture of email.fixtures) {
      const row: TreeRow = {
        id: `fixture:${email.id}:${fixture.id}`,
        kind: 'fixture',
        emailId: email.id,
        fixtureId: fixture.id,
        label: fixture.id,
        description: fixture.description,
        depth: 1,
        expanded: false,
      }
      if (fixture.expectedLocale) row.expectedLocale = fixture.expectedLocale
      rows.push(row)
    }
  }
  return rows
}
