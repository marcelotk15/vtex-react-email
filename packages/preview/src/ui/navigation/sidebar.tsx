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
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3">
        <p className="truncate font-mono text-[12px] text-muted-foreground" title={name || 'vtex-email'}>
          {name || 'vtex-email'}
        </p>
      </div>
      <div className="shrink-0 px-2 py-1">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1.5 left-2 size-3.5 text-muted-foreground" />
          <Input
            ref={searchRef}
            aria-label="Buscar email ou fixture"
            className="h-7 pl-7 text-[13px]"
            id={searchId}
            placeholder="Buscar email ou fixture"
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
        <div className="grid gap-2 px-3 py-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="ml-4 h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : visible.length === 0 && query.trim().length > 0 ? (
        <div className="grid gap-2 px-3 py-3">
          <p className="text-[13px] text-muted-foreground">Nenhum resultado para “{query.trim()}”.</p>
          <Button className="justify-self-start" size="sm" type="button" variant="outline" onClick={() => onQuery('')}>
            Limpar
          </Button>
        </div>
      ) : emails.length === 0 ? (
        <p className="px-3 py-3 text-[13px] text-muted-foreground">Nenhum email neste projeto.</p>
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
