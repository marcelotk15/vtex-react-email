import { useEffect, useRef } from 'react'

export function useWorkbenchShortcuts(input: {
  narrow: boolean
  sheet: boolean
  onOpenSearch: () => void
  onToggleNav: () => void
  onToggleProperties: () => void
  onToggleInspector: () => void
}): void {
  const pendingSearch = useRef(false)
  useEffect(() => {
    if (!input.sheet || !pendingSearch.current) return
    pendingSearch.current = false
    document.getElementById('email-search')?.focus()
  }, [input.sheet])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return
      const command = event.ctrlKey || event.metaKey
      if (command && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (input.narrow) {
          pendingSearch.current = true
          input.onOpenSearch()
        } else document.getElementById('email-search')?.focus()
        return
      }
      if (!event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        input.onToggleNav()
      } else if (key === 'p') {
        event.preventDefault()
        input.onToggleProperties()
      } else if (key === 'i') {
        event.preventDefault()
        input.onToggleInspector()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
