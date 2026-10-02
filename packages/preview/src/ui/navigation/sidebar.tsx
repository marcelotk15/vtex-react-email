import type { Ref } from 'react'

import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

import type { PreviewDiagnostic, PreviewEmail } from '../../shared/contract'

import { TemplateTree } from './template-tree'
import { filterEmails } from './tree'

export function Sidebar({
  name,
  emails,
  query,
  expanded,
  selectedEmail,
  selectedFixture,
  pending,
  diagnostics,
  loading,
  searchId,
  searchRef,
  onQuery,
  onToggle,
  onSelect,
}: {
  name: string
  emails: readonly PreviewEmail[]
  query: string
  expanded: readonly string[]
  selectedEmail: string
  selectedFixture: string
  pending: { emailId: string; fixtureId: string } | null
  diagnostics: readonly PreviewDiagnostic[]
  loading: boolean
  searchId: string
  searchRef?: Ref<HTMLInputElement>
  onQuery: (value: string) => void
  onToggle: (emailId: string) => void
  onSelect: (emailId: string, fixtureId: string) => void
}) {
  const visible = filterEmails(emails, query)
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-panel text-foreground">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <p className="type-section-title shrink-0">Stories</p>
        <p className="type-code min-w-0 truncate text-muted-foreground" title={name || 'vtex-email'}>
          {name || 'vtex-email'}
        </p>
      </div>
      <div className="shrink-0 border-b border-border px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            aria-label="Search email or fixture"
            className="h-8 type-ui pl-8"
            id={searchId}
            placeholder="Search email or fixture"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query.length > 0) {
                event.preventDefault()
                onQuery('')
              }
            }}
          />
        </div>
      </div>
      {loading ? (
        <div className="grid gap-1.5 px-3 py-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="ml-4 h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ) : visible.length === 0 && query.trim().length > 0 ? (
        <div className="grid gap-2 px-3 py-2">
          <p className="type-ui text-muted-foreground">No results for “{query.trim()}”.</p>
          <Button className="justify-self-start" size="sm" type="button" variant="outline" onClick={() => onQuery('')}>
            Clear
          </Button>
        </div>
      ) : emails.length === 0 ? (
        <p className="type-ui px-3 py-2 text-muted-foreground">No emails in this project.</p>
      ) : (
        <TemplateTree
          diagnostics={diagnostics}
          emails={emails}
          expanded={expanded}
          pending={pending}
          query={query}
          selectedEmail={selectedEmail}
          selectedFixture={selectedFixture}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      )}
    </div>
  )
}
