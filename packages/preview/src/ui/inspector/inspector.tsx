import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { PreviewDiagnostic, PreviewEmail, PreviewState } from '../../shared/contract'
import type { InspectorTab } from '../prefs/prefs'

import { CodeView, CopyButton } from './code-view'

const severityOrder = { error: 0, warning: 1, info: 2 }

export function Inspector({
  state,
  email,
  tab,
  onTab,
}: {
  state: PreviewState | null
  email: PreviewEmail | null
  tab: InspectorTab
  onTab: (tab: InspectorTab) => void
}) {
  const diagnostics = [...(state?.diagnostics ?? [])].sort((left, right) => {
    const severity = severityOrder[left.severity] - severityOrder[right.severity]
    if (severity !== 0) return severity
    const leftHere = left.templateId === state?.selection.emailId ? 0 : 1
    const rightHere = right.templateId === state?.selection.emailId ? 0 : 1
    return leftHere - rightHere
  })
  const count = diagnostics.filter((item) => item.severity === 'error' || item.severity === 'warning').length
  const fixture = email?.fixtures.find((item) => item.id === state?.selection.fixtureId)
  const data = state?.data == null ? '' : JSON.stringify(state.data, null, 2)

  return (
    <Tabs
      className="h-full min-h-0 gap-0 overflow-hidden bg-panel"
      value={tab}
      onValueChange={(value) => {
        if (value === 'data' || value === 'source' || value === 'diagnostics') onTab(value)
      }}
    >
      <div className="flex h-8 shrink-0 items-center border-b border-border pr-2">
        <TabsList className="h-8 min-w-0 flex-1 justify-start rounded-none border-0 px-2" variant="line">
          <TabsTrigger className="h-8 flex-none" value="data">
            Dados
          </TabsTrigger>
          <TabsTrigger className="h-8 flex-none" value="source">
            Handlebars
          </TabsTrigger>
          <TabsTrigger className="h-8 flex-none" value="diagnostics">
            Diagnósticos{count > 0 ? <span className="font-mono text-[11px]">{count}</span> : null}
          </TabsTrigger>
        </TabsList>
        {tab === 'data' || tab === 'source' ? (
          <CopyButton
            label={tab === 'source' ? 'Copiar' : 'Copiar JSON'}
            value={tab === 'source' ? (state?.source ?? '') : data}
          />
        ) : null}
      </div>
      <TabsContent className="min-h-0 overflow-auto" value="data">
        <div className="grid gap-2 border-b border-border px-3 py-2 text-[12px] text-muted-foreground">
          <p>{fixture?.description || 'Sem fixture selecionada.'}</p>
          {fixture ? (
            <p className="font-mono">
              {fixture.file}
              {fixture.origin ? ` · ${fixture.origin}` : ''}
              {fixture.purpose ? ` · ${fixture.purpose}` : ''}
              {fixture.expectedLocale ? ` · ${fixture.expectedLocale}` : ''}
            </p>
          ) : null}
          {state?.selection.mode === 'forced' && email ? (
            <p className="text-primary">
              {email.localePath} = {state.selection.forcedLocale} só na cópia avaliada.
            </p>
          ) : null}
        </div>
        <CodeView highlight={false} value={data} />
      </TabsContent>
      <TabsContent className="min-h-0 overflow-hidden" value="source">
        <p className="border-b border-border px-3 py-1.5 font-mono text-[12px] text-muted-foreground">
          {state?.selector ? 'Artefato combinado com seletor' : 'Variante isolada'}
        </p>
        <CodeView highlight value={state?.source ?? ''} />
      </TabsContent>
      <TabsContent className="min-h-0 overflow-auto" value="diagnostics">
        {diagnostics.length === 0 ? (
          <p className="px-3 py-3 text-[13px] text-muted-foreground">Nenhum diagnóstico.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {diagnostics.map((item, index) => (
              <DiagnosticRow key={`${item.code}-${item.message}-${index}`} item={item} />
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}

function DiagnosticRow({ item }: { item: PreviewDiagnostic }) {
  const Icon = item.severity === 'error' ? AlertCircle : item.severity === 'warning' ? AlertTriangle : Info
  const tone =
    item.severity === 'error'
      ? 'text-destructive bg-danger-tint'
      : item.severity === 'warning'
        ? 'text-[#7F5200] bg-warning-tint'
        : 'text-[#3D5A80] bg-info-tint'
  const origin = [item.templateId, item.locale, item.fixtureId, item.origin].filter(Boolean).join(' / ')
  const place = item.source
    ? `${item.source.file}${item.source.line ? `:${item.source.line}` : ''}${item.source.column ? `:${item.source.column}` : ''}`
    : ''
  return (
    <li className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 border-b border-border px-3 py-2">
      <span className={`inline-flex h-5 items-center gap-1 px-1 font-mono text-[11px] ${tone}`}>
        <Icon className="size-3" />
        {item.severity === 'error' ? 'erro' : item.severity === 'warning' ? 'aviso' : 'info'}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[12px]">
          {item.code}
          {origin ? <span className="text-muted-foreground"> · {origin}</span> : null}
        </p>
        {place ? <p className="font-mono text-[12px] text-muted-foreground">{place}</p> : null}
        <p className="text-[13px]">{item.message}</p>
      </div>
    </li>
  )
}
