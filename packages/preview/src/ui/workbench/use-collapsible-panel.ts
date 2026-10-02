import type { PanelImperativeHandle } from 'react-resizable-panels'

import { useEffect, useRef, useState } from 'react'

import { useMedia } from './use-media'

export function useCollapsiblePanel(
  query: string,
  open: boolean,
): {
  matches: boolean
  shown: boolean
  panelRef: { current: PanelImperativeHandle | null }
  show(next: boolean): void
  toggle(): boolean
} {
  const matches = useMedia(query)
  const [shown, setShown] = useState(() => open && !window.matchMedia(query).matches)
  const panelRef = useRef<PanelImperativeHandle | null>(null)
  const ready = useRef(false)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || ready.current) return
    ready.current = true
    if (matches || !open) panel.collapse()
  }, [matches, open])

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => {
      const panel = panelRef.current
      if (!panel) return
      if (media.matches) {
        panel.collapse()
        setShown(false)
      } else if (open) {
        panel.expand()
        setShown(true)
      }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [open, query])

  function toggle(): boolean {
    const panel = panelRef.current
    const opening = panel?.isCollapsed() ?? !shown
    if (opening) panel?.expand()
    else panel?.collapse()
    setShown(opening)
    return opening
  }

  function show(next: boolean): void {
    setShown(next)
  }

  return { matches, shown, panelRef, toggle, show }
}
