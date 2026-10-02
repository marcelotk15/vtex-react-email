import { ChevronRight } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'

import type { PreviewDiagnostic, PreviewEmail } from '../../shared/contract'

import { visibleRows, type TreeRow } from './tree'

export function TemplateTree({
  emails,
  query,
  expanded,
  selectedEmail,
  selectedFixture,
  pending,
  diagnostics,
  onToggle,
  onSelect,
}: {
  emails: readonly PreviewEmail[]
  query: string
  expanded: readonly string[]
  selectedEmail: string
  selectedFixture: string
  pending: { emailId: string; fixtureId: string } | null
  diagnostics: readonly PreviewDiagnostic[]
  onToggle: (emailId: string) => void
  onSelect: (emailId: string, fixtureId: string) => void
}) {
  const expandedSet = new Set(expanded)
  const rows = visibleRows(emails, query, expandedSet)
  const activeEmail = pending?.emailId ?? selectedEmail
  const activeFixture = pending?.fixtureId ?? selectedFixture
  const selectedId = rows.find(
    (row) => row.kind === 'fixture' && row.emailId === activeEmail && row.fixtureId === activeFixture,
  )?.id
  const [focusId, setFocusId] = useState(selectedId ?? rows[0]?.id ?? '')
  const current = rows.some((row) => row.id === focusId) ? focusId : (selectedId ?? rows[0]?.id ?? '')
  const errors = new Set(
    diagnostics
      .filter((item) => item.severity === 'error' && item.fixtureId && item.templateId)
      .map((item) => `${item.templateId}/${item.fixtureId}`),
  )

  function move(next: string) {
    setFocusId(next)
    document.querySelector<HTMLElement>(`[data-row="${next}"]`)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = rows.findIndex((row) => row.id === current)
    const row = rows[index]
    if (!row) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = rows[index + 1]
      if (next) move(next.id)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = rows[index - 1]
      if (next) move(next.id)
    } else if (event.key === 'Home') {
      event.preventDefault()
      const next = rows[0]
      if (next) move(next.id)
    } else if (event.key === 'End') {
      event.preventDefault()
      const next = rows.at(-1)
      if (next) move(next.id)
    } else if (event.key === 'ArrowRight' && row.kind === 'email' && !row.expanded) {
      event.preventDefault()
      onToggle(row.emailId)
    } else if (event.key === 'ArrowRight' && row.kind === 'email') {
      event.preventDefault()
      const next = rows[index + 1]
      if (next?.kind === 'fixture') move(next.id)
    } else if (event.key === 'ArrowLeft' && row.kind === 'email' && row.expanded) {
      event.preventDefault()
      onToggle(row.emailId)
    } else if (event.key === 'ArrowLeft' && row.kind === 'fixture') {
      event.preventDefault()
      move(`email:${row.emailId}`)
    } else if ((event.key === 'Enter' || event.key === ' ') && row.kind === 'fixture') {
      event.preventDefault()
      onSelect(row.emailId, row.fixtureId)
    } else if ((event.key === 'Enter' || event.key === ' ') && row.kind === 'email') {
      event.preventDefault()
      onToggle(row.emailId)
    }
  }

  if (rows.length === 0) return null

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div aria-label="Emails" className="py-1" role="tree" onKeyDown={onKeyDown}>
        {rows.map((row) => (
          <TreeItem
            key={row.id}
            activeEmail={activeEmail}
            current={current}
            errors={errors}
            row={row}
            selected={row.id === selectedId}
            onSelect={onSelect}
            onToggle={onToggle}
            onFocusRow={setFocusId}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function TreeItem({
  row,
  current,
  selected,
  activeEmail,
  errors,
  onToggle,
  onSelect,
  onFocusRow,
}: {
  row: TreeRow
  current: string
  selected: boolean
  activeEmail: string
  errors: ReadonlySet<string>
  onToggle: (emailId: string) => void
  onSelect: (emailId: string, fixtureId: string) => void
  onFocusRow: (id: string) => void
}) {
  const failed = row.kind === 'fixture' && errors.has(`${row.emailId}/${row.fixtureId}`)
  return (
    <div className={row.depth === 1 ? 'tree-guide ml-3' : undefined}>
      <div
        aria-expanded={row.kind === 'email' ? row.expanded : undefined}
        aria-level={row.depth + 1}
        aria-selected={row.kind === 'fixture' ? selected : undefined}
        className={`tree-item type-ui flex h-8 cursor-pointer items-center gap-1 pr-2 outline-none ${row.depth === 0 ? 'pl-2' : 'pl-1.5'}`}
        data-row={row.id}
        role="treeitem"
        tabIndex={row.id === current ? 0 : -1}
        title={row.description || row.label}
        onClick={() => {
          onFocusRow(row.id)
          if (row.kind === 'email') onToggle(row.emailId)
          else onSelect(row.emailId, row.fixtureId)
        }}
        onFocus={() => onFocusRow(row.id)}
      >
        {row.kind === 'email' ? (
          <ChevronRight
            className={`size-4 shrink-0 text-muted-foreground ${row.expanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span
          className={`min-w-0 flex-1 truncate ${
            row.kind === 'fixture' ? 'type-code' : row.emailId === activeEmail ? 'font-semibold' : ''
          }`}
        >
          {row.label}
        </span>
        {row.expectedLocale ? (
          <span className="type-code shrink-0 text-muted-foreground">{row.expectedLocale}</span>
        ) : null}
        {failed ? <span aria-label="Error" className="size-1.5 shrink-0 rounded-full bg-destructive" /> : null}
      </div>
    </div>
  )
}
