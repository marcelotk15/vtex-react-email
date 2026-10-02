import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'

import type { PreviewState } from '../../contract'
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
        width: Math.max(160, node.clientWidth - 48),
        height: Math.max(160, node.clientHeight - 84),
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-canvas">
      {compiling ? <div aria-hidden="true" className="compile-bar absolute inset-x-0 top-0" /> : null}
      <div ref={stage} className="flex min-h-0 flex-1 justify-center overflow-auto p-6">
        <div className="flex min-h-full flex-col items-center">
          <div
            className={`mb-2 flex h-7 shrink-0 items-center justify-between gap-3 px-1 font-mono text-[12px] ${stale ? 'bg-warning-tint text-[#7F5200]' : 'text-muted-foreground'}`}
            style={{ width: frameWidth }}
          >
            <span>
              {stale ? 'Último resultado válido · ver Diagnósticos' : 'viewport'}
              {blocked ? ' · imagens bloqueadas' : ''}
              {blocked ? (
                <span className="sr-only">
                  Imagens remotas bloqueadas nesta visualização. O template não foi alterado.
                </span>
              ) : null}
            </span>
            <span>
              {measured.width} × {measured.height}
            </span>
          </div>
          {failed || !state ? (
            <div className="grid w-[28rem] max-w-full place-items-center px-4 py-10">
              <Empty className="border-0 bg-transparent p-0">
                <EmptyHeader>
                  <EmptyTitle>{state ? 'Não foi possível atualizar' : 'Conectando ao servidor de preview.'}</EmptyTitle>
                  <EmptyDescription>
                    {state?.diagnostics[0]?.message ?? 'O último resultado válido continua disponível quando existir.'}
                  </EmptyDescription>
                </EmptyHeader>
                {state ? (
                  <Button size="sm" type="button" variant="outline" onClick={onOpenDiagnostics}>
                    Ver diagnósticos
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
