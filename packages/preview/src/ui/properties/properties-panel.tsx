import { ImageOff, Monitor, RectangleHorizontal, Smartphone, UnfoldHorizontal } from 'lucide-react'

import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import type { PreviewEmail, PreviewState } from '../../shared/contract'
import type { ViewportPreset } from '../model/viewport'
import type { PropertiesTab } from '../prefs/prefs'

import { DiagnosticsList, sortDiagnostics } from '../inspector/diagnostics-list'
import { viewportChoices } from '../model/viewport'
import { localeOptions, selectionToLocaleValue } from '../toolbar/locale-options'
import { PropertyRow, PropertySection, PropertyValue } from './property-row'

const icons = {
  mobile: Smartphone,
  desktop: Monitor,
  wide: RectangleHorizontal,
  fit: UnfoldHorizontal,
} as const

export function PropertiesPanel({
  state,
  email,
  tab,
  viewport,
  blocked,
  onTab,
  onLocale,
  onViewport,
  onBlocked,
}: {
  state: PreviewState | null
  email: PreviewEmail | null
  tab: PropertiesTab
  viewport: ViewportPreset
  blocked: boolean
  onTab: (tab: PropertiesTab) => void
  onLocale: (value: string) => void
  onViewport: (value: ViewportPreset) => void
  onBlocked: (value: boolean) => void
}) {
  const selection = state?.selection ?? null
  const fixture = email?.fixtures.find((item) => item.id === selection?.fixtureId)
  const options = localeOptions(email?.locales ?? [])
  const localeValue = selection ? selectionToLocaleValue(selection) : 'runtime'
  const forced = selection?.mode === 'forced'
  const diagnostics = state?.diagnostics ?? []
  const count = sortDiagnostics(diagnostics, state?.selection.emailId).filter(
    (item) => item.severity === 'error' || item.severity === 'warning',
  ).length

  return (
    <Tabs
      className="flex h-full min-h-0 flex-col gap-0 overflow-hidden bg-panel"
      value={tab}
      onValueChange={(value) => {
        if (value === 'properties' || value === 'diagnostics') onTab(value)
      }}
    >
      <div className="flex h-8 shrink-0 items-center border-b border-border px-1">
        <TabsList
          className="h-7 min-w-0 flex-1 justify-start rounded-none border-0 bg-transparent p-0"
          variant="default"
        >
          <TabsTrigger className="h-7 flex-none rounded-sm px-2.5" value="properties">
            Properties
          </TabsTrigger>
          <TabsTrigger className="h-7 flex-none rounded-sm px-2.5" value="diagnostics">
            Diagnostics
            {count > 0 ? (
              <span className="type-code ml-1 rounded-sm border border-border px-1 text-muted-foreground">{count}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent className="min-h-0 overflow-hidden" value="properties">
        <ScrollArea className="h-full">
          <PropertySection title="Fixture">
            {fixture ? (
              <>
                <PropertyRow label="Name">
                  <PropertyValue title={fixture.id}>{fixture.id}</PropertyValue>
                </PropertyRow>
                <PropertyRow label="Description" stack>
                  <p className="type-ui text-foreground">{fixture.description || 'No description.'}</p>
                </PropertyRow>
                <PropertyRow label="File">
                  <PropertyValue title={fixture.file}>{fixture.file}</PropertyValue>
                </PropertyRow>
                {fixture.origin ? (
                  <PropertyRow label="Origin">
                    <PropertyValue>{fixture.origin}</PropertyValue>
                  </PropertyRow>
                ) : null}
                {fixture.purpose ? (
                  <PropertyRow label="Purpose">
                    <PropertyValue>{fixture.purpose}</PropertyValue>
                  </PropertyRow>
                ) : null}
                {fixture.expectedLocale ? (
                  <PropertyRow label="Expected">
                    <PropertyValue>{fixture.expectedLocale}</PropertyValue>
                  </PropertyRow>
                ) : null}
              </>
            ) : (
              <p className="type-ui text-muted-foreground">No fixture selected.</p>
            )}
          </PropertySection>

          <PropertySection title="Locale">
            <PropertyRow label="Payload">
              <PropertyValue>{selection?.payloadLocale || 'missing'}</PropertyValue>
            </PropertyRow>
            <PropertyRow htmlFor="locale-select" label="Locale" stack>
              <Select
                items={options}
                value={localeValue}
                onValueChange={(value) => {
                  if (value) onLocale(value)
                }}
              >
                <SelectTrigger
                  aria-label="Locale"
                  className={`h-8 w-full min-w-0 ${forced ? 'border-primary bg-accent text-foreground' : ''}`}
                  id="locale-select"
                  title={forced && email ? `${email.localePath} changed only on the evaluated copy` : 'Fixture locale'}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {options.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>
            {forced && email && selection ? (
              <p className="type-meta text-foreground">
                {email.localePath} = {selection.forcedLocale} only on the evaluated copy.
              </p>
            ) : null}
          </PropertySection>

          <PropertySection title="View">
            <PropertyRow label="Viewport" stack>
              <ToggleGroup
                aria-label="Email viewport"
                className="w-full min-w-0"
                spacing={0}
                value={[viewport]}
                variant="outline"
                onValueChange={(value) => {
                  const next = value.find((item) => item !== viewport) ?? value[0]
                  if (next === 'mobile' || next === 'desktop' || next === 'wide' || next === 'fit') onViewport(next)
                }}
              >
                {viewportChoices.map((choice) => {
                  const Icon = icons[choice.id]
                  return (
                    <ToggleGroupItem
                      key={choice.id}
                      aria-label={choice.label}
                      className="h-8 min-w-0 flex-1 px-0"
                      title={choice.label}
                      value={choice.id}
                    >
                      <Icon className="size-4 shrink-0" />
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </PropertyRow>
            <PropertyRow label="Images">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Toggle
                      aria-label={blocked ? 'Show remote images' : 'Block remote images'}
                      className="h-8 gap-1.5 px-2"
                      pressed={blocked}
                      variant="outline"
                      onPressedChange={onBlocked}
                    />
                  }
                >
                  <ImageOff className={`size-4 ${blocked ? 'text-primary' : ''}`} />
                  <span className="type-ui font-normal">{blocked ? 'Blocked' : 'Allowed'}</span>
                </TooltipTrigger>
                <TooltipContent>
                  {blocked ? 'Show remote images' : 'Block remote images'}
                  <Kbd>this view only</Kbd>
                </TooltipContent>
              </Tooltip>
            </PropertyRow>
          </PropertySection>
        </ScrollArea>
      </TabsContent>

      <TabsContent className="min-h-0 overflow-auto" value="diagnostics">
        <DiagnosticsList diagnostics={diagnostics} emailId={state?.selection.emailId} />
      </TabsContent>
    </Tabs>
  )
}
