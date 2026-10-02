import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { PreviewState } from '../../shared/contract'
import type { InspectorTab } from '../prefs/prefs'

import { CodeView, CopyButton } from './code-view'
import { formatHandlebarsSource } from './format-source'

export function Inspector({
  state,
  tab,
  onTab,
}: {
  state: PreviewState | null
  tab: InspectorTab
  onTab: (tab: InspectorTab) => void
}) {
  const data = state?.data == null ? '' : JSON.stringify(state.data, null, 2)
  const source = formatHandlebarsSource(state?.source ?? '')

  return (
    <Tabs
      className="flex h-full min-h-0 flex-col gap-0 overflow-hidden bg-panel"
      value={tab}
      onValueChange={(value) => {
        if (value === 'data' || value === 'source') onTab(value)
      }}
    >
      <div className="flex h-8 shrink-0 items-center border-b border-border pr-2">
        <TabsList className="h-7 min-w-0 flex-1 justify-start rounded-none border-0 bg-transparent p-0" variant="default">
          <TabsTrigger className="h-7 flex-none rounded-sm px-2.5" value="data">
            Data
          </TabsTrigger>
          <TabsTrigger className="h-7 flex-none rounded-sm px-2.5" value="source">
            Handlebars
          </TabsTrigger>
        </TabsList>
        {tab === 'data' || tab === 'source' ? (
          <CopyButton label={tab === 'source' ? 'Copy' : 'Copy JSON'} value={tab === 'source' ? source : data} />
        ) : null}
      </div>
      <TabsContent className="flex min-h-0 flex-col overflow-auto" value="data">
        <CodeView highlight={false} value={data} />
      </TabsContent>
      <TabsContent className="flex min-h-0 flex-col overflow-hidden" value="source">
        <p className="type-meta border-b border-border px-3 py-1.5 text-muted-foreground">
          {state?.selector ? 'Combined artifact with selector' : 'Isolated variant'}
        </p>
        <CodeView highlight value={source} />
      </TabsContent>
    </Tabs>
  )
}
