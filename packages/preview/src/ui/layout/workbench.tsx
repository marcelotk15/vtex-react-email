import type { PanelImperativeHandle } from 'react-resizable-panels'

import { useEffect, useRef, useState } from 'react'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

import type { ViewportPreset } from '../model/viewport'
import type { InspectorTab } from '../prefs/prefs'

import { Canvas } from '../canvas/canvas'
import { usePreview, usePreviewClient } from '../client/preview-context'
import { Inspector } from '../inspector/inspector'
import { localeValueToSelection } from '../model/locale'
import { usePrefs } from '../prefs/prefs-context'
import { Sidebar } from '../sidebar/sidebar'
import { Toolbar } from '../toolbar/toolbar'

export function Workbench() {
  const snapshot = usePreview()
  const client = usePreviewClient()
  const { prefs, update } = usePrefs()
  const narrow = useMedia('(max-width: 1099px)')
  const short = useMedia('(max-height: 719px)')
  const compact = useMedia('(max-width: 1023px)')
  const [query, setQuery] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [navShown, setNavShown] = useState(() => prefs.sidebarOpen && !window.matchMedia('(max-width: 1099px)').matches)
  const [inspectorShown, setInspectorShown] = useState(
    () => prefs.inspectorOpen && !window.matchMedia('(max-height: 719px)').matches,
  )
  const sidebarRef = useRef<PanelImperativeHandle | null>(null)
  const inspectorRef = useRef<PanelImperativeHandle | null>(null)
  const sidebarReady = useRef(false)
  const inspectorReady = useRef(false)
  const pendingSearch = useRef(false)
  const state = snapshot.state
  const email = (state ? state.emails.find((item) => item.id === state.selection.emailId) : null) ?? null
  const fixture = email?.fixtures.find((item) => item.id === state?.selection.fixtureId)
  const status = statusLabel(snapshot)

  useEffect(() => {
    const panel = sidebarRef.current
    if (!panel || sidebarReady.current) return
    sidebarReady.current = true
    if (narrow || !prefs.sidebarOpen) panel.collapse()
  }, [narrow, prefs.sidebarOpen])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1099px)')
    const onChange = () => {
      const panel = sidebarRef.current
      if (!panel) return
      if (media.matches) {
        panel.collapse()
        setNavShown(false)
      } else if (prefs.sidebarOpen) {
        panel.expand()
        setNavShown(true)
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [prefs.sidebarOpen])

  useEffect(() => {
    const panel = inspectorRef.current
    if (!panel || inspectorReady.current) return
    inspectorReady.current = true
    if (short || !prefs.inspectorOpen) panel.collapse()
  }, [short, prefs.inspectorOpen])

  useEffect(() => {
    const media = window.matchMedia('(max-height: 719px)')
    const onChange = () => {
      const panel = inspectorRef.current
      if (!panel) return
      if (media.matches) {
        panel.collapse()
        setInspectorShown(false)
      } else if (prefs.inspectorOpen) {
        panel.expand()
        setInspectorShown(true)
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [prefs.inspectorOpen])

  useEffect(() => {
    if (!sheet || !pendingSearch.current) return
    pendingSearch.current = false
    document.getElementById('email-search')?.focus()
  }, [sheet])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return
      const command = event.ctrlKey || event.metaKey
      if (command && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (narrow) {
          pendingSearch.current = true
          setSheet(true)
        } else document.getElementById('email-search')?.focus()
        return
      }
      if (!event.altKey) return
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        toggleNav()
      } else if (event.key.toLowerCase() === 'i') {
        event.preventDefault()
        toggleInspector()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function toggleNav() {
    if (narrow) {
      setSheet((open) => !open)
      return
    }
    const panel = sidebarRef.current
    const opening = panel?.isCollapsed() ?? !navShown
    if (opening) panel?.expand()
    else panel?.collapse()
    setNavShown(opening)
    update({ sidebarOpen: opening })
  }

  function toggleInspector() {
    const panel = inspectorRef.current
    const opening = panel?.isCollapsed() ?? !inspectorShown
    if (opening) panel?.expand()
    else panel?.collapse()
    setInspectorShown(opening)
    update({ inspectorOpen: opening })
  }

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
          const panel = sidebarRef.current
          if (!panel) return
          const collapsed = panel.isCollapsed()
          setNavShown(!collapsed)
          update({
            sidebarOpen: !collapsed,
            ...(collapsed ? {} : { sidebar: Math.round(panel.getSize().inPixels) }),
          })
        }}
      >
        <ResizablePanel
          collapsedSize={0}
          collapsible
          defaultSize={navShown ? prefs.sidebar : 0}
          id="navigation"
          maxSize={360}
          minSize={200}
          panelRef={sidebarRef}
        >
          {navShown && !narrow ? navigation : null}
        </ResizablePanel>
        <ResizableHandle aria-label="Redimensionar navegação" />
        <ResizablePanel id="stage" minSize="40%">
          <div className="flex h-full min-h-0 flex-col">
            <Toolbar
              blocked={blocked}
              compact={compact}
              description={fixture?.description ?? ''}
              inspectorOpen={inspectorShown}
              localePath={email?.localePath ?? ''}
              locales={email?.locales ?? []}
              navOpen={narrow ? sheet : navShown}
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
                const panel = inspectorRef.current
                if (!panel) return
                const collapsed = panel.isCollapsed()
                setInspectorShown(!collapsed)
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
                      update({ inspectorOpen: true, tab: 'diagnostics' })
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
                panelRef={inspectorRef}
              >
                {inspectorShown ? (
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

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

function statusLabel(snapshot: ReturnType<typeof usePreview>): string {
  if (!snapshot.state) return snapshot.connection === 'reconnecting' ? 'Desconectado' : 'Conectando'
  if (snapshot.connection === 'reconnecting') return 'Desconectado'
  if (snapshot.postError) return 'Falha ao atualizar'
  if (snapshot.state.status === 'compiling') return 'Compilando'
  if (snapshot.state.status === 'stale') return snapshot.state.html ? 'Desatualizado' : 'Falha'
  return 'Atualizado'
}
