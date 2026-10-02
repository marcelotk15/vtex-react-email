import type { BlockName, DynamicAttribute, OpenMarker, ResolvedPath, SiteArgument } from '@vtex-email/core'

import { Button as EmailButton, Img as EmailImg, Link as EmailLink } from '@react-email/components'
import { emitLiteral, errorDiagnostic, parentHops, parseMessage, parsePath } from '@vtex-email/core'
import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'

import { expr, isExpression, type Expression } from './expr'
import { abort, addMarker, addSite, getSession, type Session } from './session'

function sourceOf(session: Session): { file: string } | undefined {
  return session.file ? { file: session.file } : undefined
}

function resolvePath(path: string, session: Session): ResolvedPath {
  const parsed = parsePath(path, session.profile.allowParentSegments)
  if (!parsed.ok) {
    abort(
      session,
      errorDiagnostic('HBS001', parsed.message, {
        path,
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
  }
  return { emitted: parsed.emitted, parentHops: parentHops(parsed.segments) }
}

function readArgument(arg: unknown, session: Session): SiteArgument {
  if (typeof arg === 'object' && arg !== null && 'kind' in arg && arg.kind === 'helper') {
    abort(
      session,
      errorDiagnostic('HBS002', 'Nested helper subexpressions are not supported.', {
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
  }
  if (!isExpression(arg)) {
    abort(
      session,
      errorDiagnostic('HBS002', 'Helper argument has no expression kind.', {
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
  }
  if (arg.kind === 'literal') return { kind: 'literal', emitted: emitLiteral(arg.value) }
  const path = resolvePath(arg.value, session)
  return { kind: 'path', emitted: path.emitted, path }
}

function stamp(children: ReactNode, token: string): ReactElement {
  const session = getSession()
  let only: ReactElement<{ 'data-anchor'?: string }>
  try {
    const child = Children.only(children)
    if (!isValidElement(child) || child.type === Fragment) throw new Error('not an element')
    only = child as ReactElement<{ 'data-anchor'?: string }>
  } catch (error) {
    if (error instanceof Error && error.name === 'CompileAborted') throw error
    abort(
      session,
      errorDiagnostic('DSL002', 'Each DSL block requires a single root element.', {
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
  }
  return cloneElement(only, { 'data-anchor': token })
}

function openRegion(path: string, block: BlockName, hasElse: boolean): { openId: string; elseId: string | null } {
  const session = getSession()
  const resolved = resolvePath(path, session)
  const marker: OpenMarker = {
    kind: 'open',
    open: '',
    close: '',
    elseId: null,
  }
  const openId = addMarker(session, { kind: 'open', path: resolved.emitted, detail: block }, marker)
  addSite(session, openId, { kind: 'block', block, path: resolved })
  if (!hasElse) return { openId, elseId: null }
  const elseId = addMarker(
    session,
    { kind: 'else', path: resolved.emitted, detail: `${block}:else` },
    {
      kind: 'else',
      openId,
    },
  )
  marker.elseId = elseId
  return { openId, elseId }
}

function blockRegion(path: string, block: BlockName, children: ReactNode, fallback: ReactNode | undefined): ReactNode {
  const region = openRegion(path, block, fallback !== undefined)
  const thenNode = stamp(children, region.openId)
  if (!region.elseId || fallback === undefined) return thenNode
  return (
    <>
      {thenNode}
      {stamp(fallback, region.elseId)}
    </>
  )
}

export function Value({ path }: { path: string }) {
  return textValue(path)
}

export function Helper({ name, args }: { name: string; args: readonly unknown[] }) {
  const session = getSession()
  const rendered = args.map((arg) => readArgument(arg, session))
  const token = addMarker(
    session,
    { kind: 'text', path: name, detail: rendered.map((arg) => arg.emitted).join(' ') },
    {
      kind: 'text',
      replacement: '',
    },
  )
  addSite(session, token, { kind: 'helper', helper: name, args: rendered })
  return <span data-anchor={token}>{'\u200b'}</span>
}

export function Each({ path, children, fallback }: { path: string; children: ReactNode; fallback?: ReactNode }) {
  return blockRegion(path, 'each', children, fallback)
}

export function If({ path, children, fallback }: { path: string; children: ReactNode; fallback?: ReactNode }) {
  return blockRegion(path, 'if', children, fallback)
}

export function Unless({ path, children, fallback }: { path: string; children: ReactNode; fallback?: ReactNode }) {
  return blockRegion(path, 'unless', children, fallback)
}

function assertStaticUrl(value: string, session: Session): void {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    abort(session, errorDiagnostic('HBS001', `Invalid static URL: ${value}`, { templateId: session.templateId }))
  }
  if (url.protocol !== 'https:' && url.protocol !== 'mailto:' && url.protocol !== 'tel:') {
    abort(
      session,
      errorDiagnostic('HBS001', `URL scheme is not allowed: ${url.protocol}`, {
        templateId: session.templateId,
      }),
    )
  }
}

function attributeToken(name: DynamicAttribute, value: string | Expression): string {
  const session = getSession()
  if (typeof value === 'string') {
    if (name === 'href' || name === 'src') assertStaticUrl(value, session)
    return value
  }
  if (!isExpression(value)) {
    abort(
      session,
      errorDiagnostic('DSL002', 'A dynamic attribute requires expr.path or expr.literal.', {
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
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

function rejectClassExpression(className: string | Expression | undefined, session: Session): string | undefined {
  if (className === undefined) return undefined
  if (isExpression(className)) {
    abort(
      session,
      errorDiagnostic('DSL002', 'Expressions are not supported in className.', {
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
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

function textValue(path: string): ReactElement {
  const session = getSession()
  const resolved = resolvePath(path, session)
  const token = addMarker(
    session,
    { kind: 'text', path: resolved.emitted, detail: 'value' },
    {
      kind: 'text',
      replacement: '',
    },
  )
  addSite(session, token, { kind: 'value', path: resolved })
  return <span data-anchor={token}>{'\u200b'}</span>
}

function textLiteral(value: string | number | boolean | null): ReactElement {
  const session = getSession()
  const emitted = emitLiteral(value)
  const token = addMarker(
    session,
    { kind: 'text', path: 'literal', detail: emitted },
    {
      kind: 'text',
      replacement: '',
    },
  )
  addSite(session, token, { kind: 'literal', args: [{ kind: 'literal', emitted }] })
  return <span data-anchor={token}>{'\u200b'}</span>
}

export function Trans({ id, values }: { id: string; values?: Readonly<Record<string, Expression>> }) {
  const session = getSession()
  const text = session.catalog[id]
  if (text === undefined) {
    abort(
      session,
      errorDiagnostic('I18N001', `Missing key: ${id}`, {
        locale: session.locale,
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
  }
  const parsed = parseMessage(text)
  if (!parsed.ok) {
    abort(
      session,
      errorDiagnostic('I18N001', parsed.message, {
        locale: session.locale,
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
  }
  const provided = Object.keys(values ?? {}).sort()
  const expected = parsed.placeholders.slice().sort()
  if (provided.join('\0') !== expected.join('\0')) {
    abort(
      session,
      errorDiagnostic('I18N001', `Placeholders for ${id} do not match the catalog.`, {
        locale: session.locale,
        templateId: session.templateId,
        source: sourceOf(session),
      }),
    )
  }
  return (
    <>
      {parsed.parts.map((part) => {
        if (part.type === 'text') return part.value
        const value = values?.[part.name]
        if (!value) {
          abort(
            session,
            errorDiagnostic('I18N001', `Missing placeholder value: ${part.name}`, {
              locale: session.locale,
              templateId: session.templateId,
            }),
          )
        }
        if (value.kind === 'literal') return textLiteral(value.value)
        return textValue(value.value)
      })}
    </>
  )
}

export const Vtex = {
  Each,
  If,
  Unless,
  Value,
  Helper,
  Link: DynamicLink,
  Img: DynamicImg,
  Button: DynamicButton,
}

export { expr }
