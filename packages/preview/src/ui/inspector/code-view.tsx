import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Button
      aria-live="polite"
      className="h-6 shrink-0"
      size="sm"
      type="button"
      variant="ghost"
      onClick={() => void copy()}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

export function CodeView({ value, highlight }: { value: string; highlight: boolean }) {
  const lines = value.length > 0 ? value.split('\n') : []

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-code-bg text-code-fg">
      {lines.length === 0 ? (
        <p className="type-ui px-3 py-3 text-muted-foreground">Nothing to show.</p>
      ) : (
        <pre className="type-code m-0 min-h-0 flex-1 overflow-auto px-2 py-2">
          {lines.map((line, index) => (
            <span key={index} className="flex">
              <span className="w-10 shrink-0 pr-3 text-right text-code-muted select-none">{index + 1}</span>
              <span className="min-w-0 flex-1">{highlight ? highlightLine(line) : line || ' '}</span>
            </span>
          ))}
        </pre>
      )}
    </div>
  )
}

function highlightLine(line: string) {
  const parts = line.split(/(\{\{[\s\S]*?\}\})/g)
  return parts.map((part, index) =>
    part.startsWith('{{') ? (
      <span key={index} className="text-syntax-mustache">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}
