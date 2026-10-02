import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

import type { PreviewDiagnostic } from '../../shared/contract'

const severityOrder = { error: 0, warning: 1, info: 2 }

export function sortDiagnostics(
  diagnostics: readonly PreviewDiagnostic[],
  emailId: string | undefined,
): PreviewDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const severity = severityOrder[left.severity] - severityOrder[right.severity]
    if (severity !== 0) return severity
    const leftHere = left.templateId === emailId ? 0 : 1
    const rightHere = right.templateId === emailId ? 0 : 1
    return leftHere - rightHere
  })
}

export function DiagnosticsList({
  diagnostics,
  emailId,
}: {
  diagnostics: readonly PreviewDiagnostic[]
  emailId?: string
}) {
  const items = sortDiagnostics(diagnostics, emailId)
  if (items.length === 0) {
    return <p className="type-ui px-3 py-2 text-muted-foreground">No diagnostics.</p>
  }
  return (
    <ul className="m-0 list-none p-0">
      {items.map((item, index) => (
        <DiagnosticRow key={`${item.code}-${item.message}-${index}`} item={item} />
      ))}
    </ul>
  )
}

function DiagnosticRow({ item }: { item: PreviewDiagnostic }) {
  const Icon = item.severity === 'error' ? AlertCircle : item.severity === 'warning' ? AlertTriangle : Info
  const tone =
    item.severity === 'error'
      ? 'border-destructive/40 bg-danger-tint'
      : item.severity === 'warning'
        ? 'border-border bg-warning-tint'
        : 'border-border bg-info-tint'
  const iconTone =
    item.severity === 'error'
      ? 'text-destructive'
      : item.severity === 'warning'
        ? 'text-warning'
        : 'text-info'
  const origin = [item.templateId, item.locale, item.fixtureId, item.origin].filter(Boolean).join(' / ')
  const place = item.source
    ? `${item.source.file}${item.source.line ? `:${item.source.line}` : ''}${item.source.column ? `:${item.source.column}` : ''}`
    : ''
  return (
    <li className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 border-b border-border px-3 py-2">
      <span
        className={`type-meta inline-flex h-7 items-center gap-1 border bg-clip-padding px-1.5 text-foreground ${tone}`}
      >
        <Icon className={`size-3.5 ${iconTone}`} />
        {item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'info'}
      </span>
      <div className="min-w-0">
        <p className="type-code">
          {item.code}
          {origin ? <span className="text-muted-foreground"> · {origin}</span> : null}
        </p>
        {place ? <p className="type-code text-muted-foreground">{place}</p> : null}
        <p className="type-ui">{item.message}</p>
      </div>
    </li>
  )
}
