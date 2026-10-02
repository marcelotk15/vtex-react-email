import { useState } from 'react'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

import type { ViewportPreset } from '../model/viewport'
import type { InspectorTab, PropertiesTab } from '../prefs/prefs'

import { Canvas } from '../canvas/canvas'
import { usePreview, usePreviewClient } from '../client/preview-context'
import { Inspector } from '../inspector/inspector'
import { Sidebar } from '../navigation/sidebar'
import { PropertiesPanel } from '../properties/properties-panel'
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
  const [query, setQuery] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [navSheet, setNavSheet] = useState(false)
  const [propertiesSheet, setPropertiesSheet] = useState(false)
  const navigationPanel = useCollapsiblePanel('(max-width: 1099px)', prefs.sidebarOpen)
  const propertiesPanel = useCollapsiblePanel('(max-width: 1099px)', prefs.propertiesOpen)
  const inspectorPanel = useCollapsiblePanel('(max-height: 719px)', prefs.inspectorOpen)
  const state = snapshot.state
  const email = (state ? state.emails.find((item) => item.id === state.selection.emailId) : null) ?? null
  const fixture = email?.fixtures.find((item) => item.id === state?.selection.fixtureId)
  const status = statusLabel(snapshot)

  function toggleNav() {
    if (narrow) {
      setNavSheet((open) => !open)
      return
    }
    const opening = !navigationPanel.shown
    const panel = navigationPanel.panelRef.current
    if (opening) {
      panel?.resize(prefs.sidebar)
      navigationPanel.show(true)
    } else {
      panel?.collapse()
      navigationPanel.show(false)
    }
    update({ sidebarOpen: opening })
  }

  function toggleProperties() {
    if (narrow) {
      setPropertiesSheet((open) => !open)
      return
    }
    const opening = !propertiesPanel.shown
    const panel = propertiesPanel.panelRef.current
    if (opening) {
      panel?.resize(prefs.properties)
      propertiesPanel.show(true)
    } else {
      panel?.collapse()
      propertiesPanel.show(false)
    }
    update({ propertiesOpen: opening })
  }

  function toggleInspector() {
    const opening = !inspectorPanel.shown
    const panel = inspectorPanel.panelRef.current
    if (opening) {
      panel?.resize(prefs.inspector)
      inspectorPanel.show(true)
    } else {
      panel?.collapse()
      inspectorPanel.show(false)
    }
    update({ inspectorOpen: opening })
  }

  function openDiagnostics() {
    if (narrow) {
      setPropertiesSheet(true)
    } else if (!propertiesPanel.shown) {
      propertiesPanel.panelRef.current?.resize(prefs.properties)
      propertiesPanel.show(true)
    }
    update({ propertiesOpen: true, propertiesTab: 'diagnostics' })
  }

  useWorkbenchShortcuts({
    narrow,
    sheet: navSheet,
    onOpenSearch: () => setNavSheet(true),
    onToggleNav: toggleNav,
    onToggleProperties: toggleProperties,
    onToggleInspector: toggleInspector,
  })

  function selectFixture(emailId: string, fixtureId: string) {
    client.select({ emailId, fixtureId })
    if (!prefs.expanded.includes(emailId)) update({ expanded: [...prefs.expanded, emailId] })
    if (narrow) setNavSheet(false)
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

  const properties = (
    <PropertiesPanel
      blocked={blocked}
      email={email}
      state={state}
      tab={prefs.propertiesTab}
      viewport={prefs.viewport}
      onBlocked={setBlocked}
      onLocale={(value) => client.select(localeValueToSelection(value))}
      onTab={(tab: PropertiesTab) => update({ propertiesTab: tab })}
      onViewport={(value: ViewportPreset) => update({ viewport: value })}
    />
  )

  const navOpen = narrow ? navSheet : navigationPanel.shown
  const propertiesOpen = narrow ? propertiesSheet : propertiesPanel.shown

  return (
    <div className="flex h-full min-h-0 bg-app text-foreground">
      <ResizablePanelGroup
        orientation="horizontal"
        onLayoutChanged={(_layout, meta) => {
          if (!meta.isUserInteraction || narrow) return
          const nav = navigationPanel.panelRef.current
          const props = propertiesPanel.panelRef.current
          const patch: Partial<{
            sidebarOpen: boolean
            sidebar: number
            propertiesOpen: boolean
            properties: number
          }> = {}
          if (nav) {
            const collapsed = nav.isCollapsed()
            navigationPanel.show(!collapsed)
            patch.sidebarOpen = !collapsed
            if (!collapsed) patch.sidebar = Math.round(nav.getSize().inPixels)
          }
          if (props) {
            const collapsed = props.isCollapsed()
            propertiesPanel.show(!collapsed)
            patch.propertiesOpen = !collapsed
            if (!collapsed) patch.properties = Math.round(props.getSize().inPixels)
          }
          if (Object.keys(patch).length > 0) update(patch)
        }}
      >
        <ResizablePanel
          collapsedSize={0}
          collapsible
          defaultSize={prefs.sidebar}
          id="navigation"
          maxSize={360}
          minSize={200}
          panelRef={navigationPanel.panelRef}
        >
          {navigationPanel.shown && !narrow ? navigation : null}
        </ResizablePanel>
        <ResizableHandle aria-label="Resize navigation" />
        <ResizablePanel id="stage" minSize="30%">
          <div className="flex h-full min-h-0 flex-col">
            <Toolbar
              description={fixture?.description ?? ''}
              inspectorOpen={inspectorPanel.shown}
              navOpen={navOpen}
              propertiesOpen={propertiesOpen}
              selection={state?.selection ?? null}
              status={status}
              onToggleInspector={toggleInspector}
              onToggleNav={toggleNav}
              onToggleProperties={toggleProperties}
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
                    onOpenDiagnostics={openDiagnostics}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle aria-label="Resize inspector" />
              <ResizablePanel
                collapsedSize={0}
                collapsible
                defaultSize={prefs.inspector}
                id="inspector"
                minSize={160}
                panelRef={inspectorPanel.panelRef}
              >
                {inspectorPanel.shown ? (
                  <Inspector state={state} tab={prefs.tab} onTab={(tab: InspectorTab) => update({ tab })} />
                ) : null}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </ResizablePanel>
        <ResizableHandle aria-label="Resize properties" />
        <ResizablePanel
          collapsedSize={0}
          collapsible
          defaultSize={prefs.properties}
          id="properties"
          maxSize={420}
          minSize={220}
          panelRef={propertiesPanel.panelRef}
        >
          {propertiesPanel.shown && !narrow ? properties : null}
        </ResizablePanel>
      </ResizablePanelGroup>

      <Sheet open={narrow && navSheet} onOpenChange={setNavSheet}>
        <SheetContent className="w-72 gap-0 border-r border-border p-0 shadow-lg" showCloseButton side="left">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {narrow && navSheet ? navigation : null}
        </SheetContent>
      </Sheet>

      <Sheet open={narrow && propertiesSheet} onOpenChange={setPropertiesSheet}>
        <SheetContent className="w-80 gap-0 border-l border-border p-0 shadow-lg" showCloseButton side="right">
          <SheetTitle className="sr-only">Properties</SheetTitle>
          {narrow && propertiesSheet ? properties : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
