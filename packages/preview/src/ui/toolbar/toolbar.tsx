import { PanelBottom, PanelLeft, PanelRight } from 'lucide-react'

import type { PreviewSelection } from '../../shared/contract'

import { IconButton } from '../components/icon-button'
import { ThemeControl } from '../theme/theme-control'

export function Toolbar({
  selection,
  description,
  status,
  navOpen,
  propertiesOpen,
  inspectorOpen,
  onToggleNav,
  onToggleProperties,
  onToggleInspector,
}: {
  selection: PreviewSelection | null
  description: string
  status: string
  navOpen: boolean
  propertiesOpen: boolean
  inspectorOpen: boolean
  onToggleNav: () => void
  onToggleProperties: () => void
  onToggleInspector: () => void
}) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-panel px-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <IconButton label={navOpen ? 'Collapse navigation' : 'Open navigation'} shortcut="Alt+S" onClick={onToggleNav}>
          <PanelLeft className="size-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          {selection?.emailId ? (
            <div className="min-w-0">
              <p className="type-email-title truncate" title={selection.emailId}>
                {selection.emailId}
              </p>
              <p className="flex min-w-0 items-baseline gap-2 truncate">
                <span className="type-code shrink-0" title={selection.fixtureId}>
                  {selection.fixtureId}
                </span>
                {description ? (
                  <span className="type-meta truncate text-muted-foreground" title={description}>
                    {description}
                  </span>
                ) : null}
              </p>
            </div>
          ) : (
            <p className="type-ui text-muted-foreground">No scenario</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ThemeControl />
        <IconButton
          label={propertiesOpen ? 'Collapse properties' : 'Open properties'}
          shortcut="Alt+P"
          onClick={onToggleProperties}
        >
          <PanelRight className="size-4" />
        </IconButton>
        <IconButton
          label={inspectorOpen ? 'Collapse inspector' : 'Open inspector'}
          shortcut="Alt+I"
          onClick={onToggleInspector}
        >
          <PanelBottom className="size-4" />
        </IconButton>
        <span aria-live="polite" className="type-code inline-block w-28 shrink-0 text-right text-muted-foreground">
          {status}
        </span>
      </div>
    </header>
  )
}
