import type { DynamicAttribute } from '@vtex-email/core'
import type { ReactNode } from 'react'

import { Button as EmailButton, Img as EmailImg, Link as EmailLink } from '@react-email/components'
import { emitLiteral } from '@vtex-email/core'

import { addMarker, addSite, getSession, type Session } from '../compile/session'
import { isExpression, type Expression } from './expr'
import { dslFailure, resolvePath } from './resolve'

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

export function attributeToken(name: DynamicAttribute, value: string | Expression): string {
  const session = getSession()
  if (typeof value === 'string') {
    if (name === 'href' || name === 'src') assertStaticUrl(value, session)
    return value
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
  href: string | Expression
  title?: string | Expression
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
}: {
  src: string | Expression
  alt: string | Expression
  title?: string | Expression
  width: number
  height: number
}) {
  return (
    <EmailImg
      alt={attributeToken('alt', alt)}
      height={height}
      src={attributeToken('src', src)}
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
  href: string | Expression
  title?: string | Expression
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
