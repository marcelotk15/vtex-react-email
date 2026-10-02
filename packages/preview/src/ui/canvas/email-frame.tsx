import { memo, useEffect, useRef } from 'react'

import { displayDocument } from '../../shared/display-document'

export const EmailFrame = memo(function EmailFrame({
  html,
  blocked,
  title,
  width,
  height,
  onMeasure,
}: {
  html: string
  blocked: boolean
  title: string
  width: number | string
  height: number | string
  onMeasure: (size: { width: number; height: number }) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const doc = displayDocument(html, blocked)
  const docRef = useRef('')

  useEffect(() => {
    const node = frame.current
    if (!node) return
    node.setAttribute('sandbox', '')
    if (docRef.current === doc) return
    docRef.current = doc
    node.srcdoc = doc
  }, [doc])

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const observer = new ResizeObserver(() => {
      onMeasure({ width: node.offsetWidth, height: node.offsetHeight })
    })
    observer.observe(node)
    onMeasure({ width: node.offsetWidth, height: node.offsetHeight })
    return () => observer.disconnect()
  }, [onMeasure, width, height])

  return (
    <iframe
      ref={frame}
      className="block shrink-0 border-0"
      data-testid="email-frame"
      sandbox=""
      style={{ width, height }}
      title={title}
    />
  )
})
