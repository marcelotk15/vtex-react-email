import type { DynamicAttribute, SiteArgument } from '@vtex-email/core'
import type { ReactNode } from 'react'

import { Button as EmailButton, Img as EmailImg, Link as EmailLink } from '@react-email/components'
import { emitLiteral } from '@vtex-email/core'

import { addMarker, addSite, getSession, type Session } from '../compile/session'
import { isExpression, type Expression } from './expr'
import { dslFailure, resolvePath } from './resolve'

export type AttributeValue = string | Expression | ReadonlyArray<string | Expression>

function assertStaticUrl(value: string, session: Session): void {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    dslFailure(session, 'HBS001', `Invalid static URL: ${value}`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'mailto:' && url.protocol !== 'tel:') {
    dslFailure(session, 'HBS001', `URL scheme is not allowed: ${url.protocol}`)
  }
}

function readCompositePart(part: string | Expression, session: Session): SiteArgument {
  if (typeof part === 'string') {
    if (part.includes('"') || part.includes('\n') || part.includes('\r')) {
      dslFailure(session, 'HBS001', 'Composite attribute literals cannot contain quotes or newlines.')
    }
    return { kind: 'literal', emitted: part }
  }
  if (!isExpression(part)) {
    dslFailure(session, 'DSL002', 'A dynamic attribute requires expr.path or expr.literal.')
  }
  if (part.kind === 'literal') {
    const text = part.value === null || typeof part.value === 'boolean' ? String(part.value) : String(part.value)
    if (text.includes('"') || text.includes('\n') || text.includes('\r')) {
      dslFailure(session, 'HBS001', 'Composite attribute literals cannot contain quotes or newlines.')
    }
    return { kind: 'literal', emitted: text }
  }
  const resolved = resolvePath(part.value, session)
  return { kind: 'path', emitted: resolved.emitted, path: resolved }
}

export function attributeToken(name: DynamicAttribute, value: AttributeValue): string {
  const session = getSession()
  if (typeof value === 'string') {
    if (name === 'href' || name === 'src') assertStaticUrl(value, session)
    return value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) dslFailure(session, 'DSL002', 'A composite attribute requires at least one part.')
    const parts = value.map((part) => readCompositePart(part, session))
    const hasPath = parts.some((part) => part.kind === 'path')
    if (!hasPath && (name === 'href' || name === 'src')) {
      assertStaticUrl(parts.map((part) => part.emitted).join(''), session)
    }
    const detail = parts.map((part) => part.emitted).join('')
    const token = addMarker(
      session,
      { kind: 'attr', path: name, detail },
      {
        kind: 'attr',
        attribute: name,
        replacement: '',
      },
    )
    addSite(session, token, { kind: 'attr', attribute: name, args: parts })
    return token
  }
  if (!isExpression(value)) {
    dslFailure(session, 'DSL002', 'A dynamic attribute requires expr.path or expr.literal.')
  }
  if (value.kind === 'literal') {
    const emitted = emitLiteral(value.value)
    const token = addMarker(
      session,
      { kind: 'attr', path: name, detail: name },
      {
        kind: 'attr',
        attribute: name,
        replacement: '',
      },
    )
    addSite(session, token, { kind: 'attr', attribute: name, args: [{ kind: 'literal', emitted }] })
    return token
  }
  const resolved = resolvePath(value.value, session)
  const token = addMarker(
    session,
    { kind: 'attr', path: resolved.emitted, detail: name },
    {
      kind: 'attr',
      attribute: name,
      replacement: '',
    },
  )
  addSite(session, token, { kind: 'attr', attribute: name, path: resolved })
  return token
}

export function rejectClassExpression(
  className: string | Expression | undefined,
  session: Session,
): string | undefined {
  if (className === undefined) return undefined
  if (isExpression(className)) {
    dslFailure(session, 'DSL002', 'Expressions are not supported in className.')
  }
  return className
}

export function DynamicLink({
  href,
  title,
  children,
  className,
}: {
  href: AttributeValue
  title?: AttributeValue
  children?: ReactNode
  className?: string | Expression
}) {
  const session = getSession()
  return (
    <EmailLink
      className={rejectClassExpression(className, session)}
      href={attributeToken('href', href)}
      title={title === undefined ? undefined : attributeToken('title', title)}
    >
      {children}
    </EmailLink>
  )
}

export function DynamicImg({
  src,
  alt,
  title,
  width,
  height,
  style,
}: {
  src: AttributeValue
  alt: AttributeValue
  title?: AttributeValue
  width?: number | `${number}`
  height?: number | `${number}`
  style?: React.CSSProperties
}) {
  return (
    <EmailImg
      alt={attributeToken('alt', alt)}
      height={height}
      src={attributeToken('src', src)}
      style={style}
      title={title === undefined ? undefined : attributeToken('title', title)}
      width={width}
    />
  )
}

export function DynamicButton({
  href,
  title,
  children,
  className,
}: {
  href: AttributeValue
  title?: AttributeValue
  children?: ReactNode
  className?: string | Expression
}) {
  const session = getSession()
  return (
    <EmailButton
      className={rejectClassExpression(className, session)}
      href={attributeToken('href', href)}
      title={title === undefined ? undefined : attributeToken('title', title)}
    >
      {children}
    </EmailButton>
  )
}
