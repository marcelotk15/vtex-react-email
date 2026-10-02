import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'

import type { PreviewState } from '../../shared/contract'
import type { ViewportPreset } from '../model/viewport'

import { viewportChoice } from '../model/viewport'
import { EmailFrame } from './email-frame'

export function Canvas({
  state,
  viewport,
  blocked,
  onOpenDiagnostics,
}: {
  state: PreviewState | null
  viewport: ViewportPreset
  blocked: boolean
  onOpenDiagnostics: () => void
}) {
  const choice = viewportChoice(viewport)
  const stage = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState({ width: 720, height: 480 })
  const [measured, setMeasured] = useState({ width: choice.width ?? 720, height: choice.height ?? 480 })
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () => {
      setSpace({
        width: Math.max(160, node.clientWidth - 32),
        height: Math.max(160, node.clientHeight - 64),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const frameWidth = choice.width ?? space.width
  const frameHeight = choice.height ?? space.height
  const stale = state?.status === 'stale' && Boolean(state.html)
  const failed = state?.status === 'stale' && !state.html
  const compiling = state?.status === 'compiling'
  const title = state?.selection.emailId ? `Email: ${state.selection.emailId} / ${state.selection.fixtureId}` : 'Email'
  const onMeasure = useCallback((size: { width: number; height: number }) => {
    setMeasured((current) => (current.width === size.width && current.height === size.height ? current : size))
  }, [])
  const frameLabel = choice.width == null ? choice.label : `${choice.label} · ${choice.width}px`
  const sizeLabel = `${measured.width} × ${measured.height}`

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-canvas">
      {compiling ? <div aria-hidden="true" className="compile-bar absolute inset-x-0 top-0" /> : null}
      <div ref={stage} className="flex min-h-0 flex-1 justify-center overflow-auto p-3">
        <div className="flex min-h-full flex-col items-center">
          <div
            className={`mb-1.5 flex h-6 shrink-0 items-center justify-between gap-3 ${
              stale ? 'border border-border bg-warning-tint px-1.5 text-foreground' : 'px-0.5 text-muted-foreground'
            }`}
            style={{ width: frameWidth }}
          >
            <span className={stale ? 'type-meta' : 'type-code'}>
              {stale ? 'Last valid result · see Diagnostics' : frameLabel}
              {blocked ? ' · images blocked' : ''}
              {blocked ? (
                <span className="sr-only">Remote images are blocked in this view. The template was not changed.</span>
              ) : null}
            </span>
            <span className="type-code" title="Rendered frame size">
              {sizeLabel}
            </span>
          </div>
          {failed || !state ? (
            <div className="w-md max-w-full py-2">
              <Empty className="p-0">
                <EmptyHeader>
                  <EmptyTitle>{state ? 'Could not update' : 'Connecting to the preview server.'}</EmptyTitle>
                  <EmptyDescription>
                    {state?.diagnostics[0]?.message ?? 'The last valid result remains available when one exists.'}
                  </EmptyDescription>
                </EmptyHeader>
                {state ? (
                  <Button size="sm" type="button" variant="outline" onClick={onOpenDiagnostics}>
                    View diagnostics
                  </Button>
                ) : null}
              </Empty>
            </div>
          ) : (
            <EmailFrame
              blocked={blocked}
              height={frameHeight}
              html={state.html}
              title={title}
              width={frameWidth}
              onMeasure={onMeasure}
            />
          )}
        </div>
      </div>
    </div>
  )
}
