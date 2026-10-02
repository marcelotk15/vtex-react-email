import { useState } from 'react'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

import type { ViewportPreset } from '../model/viewport'
import type { InspectorTab } from '../prefs/prefs'

import { Canvas } from '../canvas/canvas'
import { usePreview, usePreviewClient } from '../client/preview-context'
import { Inspector } from '../inspector/inspector'
import { Sidebar } from '../navigation/sidebar'
import { usePrefs } from '../prefs/prefs-context'
import { localeValueToSelection } from '../toolbar/locale-options'
import { Toolbar } from '../toolbar/toolbar'
import { statusLabel } from './status-label'
import { useCollapsiblePanel } from './use-collapsible-panel'
import { useMedia } from './use-media'
import { useWorkbenchShortcuts } from './use-workbench-shortcuts'

export function Workbench() {
  const snapshot = usePreview()
  const client = usePreviewClient()
  const { prefs, update } = usePrefs()
  const narrow = useMedia('(max-width: 1099px)')
  const compact = useMedia('(max-width: 1023px)')
  const [query, setQuery] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [sheet, setSheet] = useState(false)
  const navigationPanel = useCollapsiblePanel('(max-width: 1099px)', prefs.sidebarOpen)
  const inspectorPanel = useCollapsiblePanel('(max-height: 719px)', prefs.inspectorOpen)
  const state = snapshot.state
  const email = (state ? state.emails.find((item) => item.id === state.selection.emailId) : null) ?? null
  const fixture = email?.fixtures.find((item) => item.id === state?.selection.fixtureId)
  const status = statusLabel(snapshot)

  function toggleNav() {
    if (narrow) {
      setSheet((open) => !open)
      return
    }
    update({ sidebarOpen: navigationPanel.toggle() })
  }

  function toggleInspector() {
    update({ inspectorOpen: inspectorPanel.toggle() })
  }

  useWorkbenchShortcuts({
    narrow,
    sheet,
    onOpenSearch: () => setSheet(true),
    onToggleNav: toggleNav,
    onToggleInspector: toggleInspector,
  })

  function selectFixture(emailId: string, fixtureId: string) {
    client.select({ emailId, fixtureId })
    if (!prefs.expanded.includes(emailId)) update({ expanded: [...prefs.expanded, emailId] })
    if (narrow) setSheet(false)
  }

  function toggleEmail(emailId: string) {
    update({
      expanded: prefs.expanded.includes(emailId)
        ? prefs.expanded.filter((item) => item !== emailId)
        : [...prefs.expanded, emailId],
    })
  }

  const navigation = (
    <Sidebar
      diagnostics={state?.diagnostics ?? []}
      emails={state?.emails ?? []}
      expanded={prefs.expanded}
      loading={state === null}
      name={state?.project.name ?? ''}
      pending={snapshot.pending}
      query={query}
      searchId="email-search"
      selectedEmail={state?.selection.emailId ?? ''}
      selectedFixture={state?.selection.fixtureId ?? ''}
      onQuery={setQuery}
      onSelect={selectFixture}
      onToggle={toggleEmail}
    />
  )

  return (
    <div className="flex h-full min-h-0 bg-app text-foreground">
      <ResizablePanelGroup
        orientation="horizontal"
        onLayoutChanged={(_layout, meta) => {
          if (!meta.isUserInteraction || narrow) return
          const panel = navigationPanel.panelRef.current
          if (!panel) return
          const collapsed = panel.isCollapsed()
          navigationPanel.show(!collapsed)
          update({
            sidebarOpen: !collapsed,
            ...(collapsed ? {} : { sidebar: Math.round(panel.getSize().inPixels) }),
          })
        }}
      >
        <ResizablePanel
          collapsedSize={0}
          collapsible
          defaultSize={navigationPanel.shown ? prefs.sidebar : 0}
          id="navigation"
          maxSize={360}
          minSize={200}
          panelRef={navigationPanel.panelRef}
        >
          {navigationPanel.shown && !narrow ? navigation : null}
        </ResizablePanel>
        <ResizableHandle aria-label="Redimensionar navegação" />
        <ResizablePanel id="stage" minSize="40%">
          <div className="flex h-full min-h-0 flex-col">
            <Toolbar
              blocked={blocked}
              compact={compact}
              description={fixture?.description ?? ''}
              inspectorOpen={inspectorPanel.shown}
              localePath={email?.localePath ?? ''}
              locales={email?.locales ?? []}
              navOpen={narrow ? sheet : navigationPanel.shown}
              selection={state?.selection ?? null}
              status={status}
              viewport={prefs.viewport}
              onBlocked={setBlocked}
              onLocale={(value) => client.select(localeValueToSelection(value))}
              onToggleInspector={toggleInspector}
              onToggleNav={toggleNav}
              onViewport={(value: ViewportPreset) => update({ viewport: value })}
            />
            <ResizablePanelGroup
              orientation="vertical"
              onLayoutChanged={(_layout, meta) => {
                if (!meta.isUserInteraction) return
                const panel = inspectorPanel.panelRef.current
                if (!panel) return
                const collapsed = panel.isCollapsed()
                inspectorPanel.show(!collapsed)
                update({
                  inspectorOpen: !collapsed,
                  ...(collapsed ? {} : { inspector: Math.round(panel.getSize().inPixels) }),
                })
              }}
            >
              <ResizablePanel id="canvas" minSize="20%">
                <div className="flex h-full min-h-0 flex-col">
                  <Canvas
                    blocked={blocked}
                    state={state}
                    viewport={prefs.viewport}
                    onOpenDiagnostics={() => {
                      if (!inspectorPanel.shown) {
                        inspectorPanel.toggle()
                        update({ inspectorOpen: true, tab: 'diagnostics' })
                      } else {
                        update({ inspectorOpen: true, tab: 'diagnostics' })
                      }
                    }}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle aria-label="Redimensionar inspetor" />
              <ResizablePanel
                collapsedSize={0}
                collapsible
                defaultSize={prefs.inspectorOpen ? prefs.inspector : 0}
                id="inspector"
                minSize={160}
                panelRef={inspectorPanel.panelRef}
              >
                {inspectorPanel.shown ? (
                  <Inspector
                    email={email}
                    state={state}
                    tab={prefs.tab}
                    onTab={(tab: InspectorTab) => update({ tab })}
                  />
                ) : null}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <Sheet open={narrow && sheet} onOpenChange={setSheet}>
        <SheetContent className="w-[248px] gap-0 p-0 shadow-md" showCloseButton side="left">
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          {narrow && sheet ? navigation : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
