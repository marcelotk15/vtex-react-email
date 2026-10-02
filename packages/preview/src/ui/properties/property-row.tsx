import type { ReactNode } from 'react'

export function PropertySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border">
      <h2 className="type-section-title px-3 py-2 text-foreground">{title}</h2>
      <div className="flex flex-col gap-1 px-3 pb-3">{children}</div>
    </section>
  )
}

export function PropertyRow({
  label,
  htmlFor,
  children,
  stack = false,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
  stack?: boolean
}) {
  if (stack) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="type-meta text-muted-foreground" htmlFor={htmlFor}>
          {label}
        </label>
        {children}
      </div>
    )
  }
  return (
    <div className="grid min-h-8 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <label className="type-meta truncate text-muted-foreground" htmlFor={htmlFor} title={label}>
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function PropertyValue({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <p className="type-code truncate text-foreground" title={title}>
      {children}
    </p>
  )
}
