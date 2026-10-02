import {
  ImageOff,
  Monitor,
  PanelBottom,
  PanelLeft,
  RectangleHorizontal,
  Smartphone,
  UnfoldHorizontal,
} from 'lucide-react'

import { Kbd } from '@/components/ui/kbd'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import type { PreviewSelection } from '../../shared/contract'

import { IconButton } from '../components/icon-button'
import { viewportChoices, type ViewportPreset } from '../model/viewport'
import { localeOptions, selectionToLocaleValue } from './locale-options'

const icons = {
  mobile: Smartphone,
  desktop: Monitor,
  wide: RectangleHorizontal,
  fit: UnfoldHorizontal,
} as const

export function Toolbar({
  selection,
  description,
  locales,
  localePath,
  viewport,
  compact,
  blocked,
  status,
  navOpen,
  inspectorOpen,
  onLocale,
  onViewport,
  onBlocked,
  onToggleNav,
  onToggleInspector,
}: {
  selection: PreviewSelection | null
  description: string
  locales: readonly string[]
  localePath: string
  viewport: ViewportPreset
  compact: boolean
  blocked: boolean
  status: string
  navOpen: boolean
  inspectorOpen: boolean
  onLocale: (value: string) => void
  onViewport: (value: ViewportPreset) => void
  onBlocked: (value: boolean) => void
  onToggleNav: () => void
  onToggleInspector: () => void
}) {
  const options = localeOptions(locales)
  const localeValue = selection ? selectionToLocaleValue(selection) : 'runtime'
  const forced = selection?.mode === 'forced'
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel px-2">
      <IconButton label={navOpen ? 'Recolher navegação' : 'Abrir navegação'} shortcut="Alt+S" onClick={onToggleNav}>
        <PanelLeft className="size-4" />
      </IconButton>
      <div className="min-w-0 flex-1">
        {selection?.emailId ? (
          <p className="truncate text-[13px]">
            <span>{selection.emailId}</span>
            <span className="px-1.5 text-muted-foreground">/</span>
            <span className="font-mono text-[12px]">{selection.fixtureId}</span>
            {description ? <span className="ml-2 text-muted-foreground">{description}</span> : null}
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhum cenário</p>
        )}
      </div>
      <div className="hidden h-5 w-px bg-border sm:block" />
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[12px] text-muted-foreground">
          payload {selection?.payloadLocale || 'ausente'}
        </span>
        <Select
          items={options}
          value={localeValue}
          onValueChange={(value) => {
            if (value) onLocale(value)
          }}
        >
          <SelectTrigger
            aria-label="Locale"
            className={`h-7 min-w-36 text-[13px] ${forced ? 'border-primary text-primary' : ''}`}
            size="sm"
            title={forced ? `${localePath} alterado só na cópia avaliada` : 'Locale da fixture'}
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
      </div>
      <div className="hidden h-5 w-px bg-border md:block" />
      <ToggleGroup
        aria-label="Viewport do email"
        className="shrink-0"
        size="sm"
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
            <ToggleGroupItem key={choice.id} aria-label={choice.label} className="h-7 px-2" value={choice.id}>
              {compact ? <Icon className="size-3.5" /> : choice.label}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              aria-label={blocked ? 'Mostrar imagens remotas' : 'Bloquear imagens remotas'}
              className="size-8"
              pressed={blocked}
              variant="outline"
              onPressedChange={onBlocked}
            />
          }
        >
          <ImageOff className={`size-4 ${blocked ? 'text-primary' : ''}`} />
        </TooltipTrigger>
        <TooltipContent>
          {blocked ? 'Mostrar imagens remotas' : 'Bloquear imagens remotas'}
          <Kbd>somente nesta visualização</Kbd>
        </TooltipContent>
      </Tooltip>
      <IconButton
        label={inspectorOpen ? 'Recolher inspetor' : 'Abrir inspetor'}
        shortcut="Alt+I"
        onClick={onToggleInspector}
      >
        <PanelBottom className="size-4" />
      </IconButton>
      <span
        aria-live="polite"
        className="inline-block w-28 shrink-0 text-right font-mono text-[12px] text-muted-foreground"
      >
        {status}
      </span>
    </header>
  )
}
