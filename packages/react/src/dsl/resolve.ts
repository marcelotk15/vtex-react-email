import type { Diagnostic, ResolvedPath, SiteArgument } from '@vtex-email/core'

import { emitLiteral, errorDiagnostic, parentHops, parsePath } from '@vtex-email/core'

import type { Session } from '../compile/session'

import { abort } from '../compile/session'
import { isExpression } from './expr'

export function dslFailure(
  session: Session,
  code: string,
  message: string,
  extra: Omit<Diagnostic, 'code' | 'severity' | 'message' | 'templateId' | 'source'> = {},
): never {
  abort(
    session,
    errorDiagnostic(code, message, {
      ...extra,
      templateId: session.templateId,
      ...(session.file ? { source: { file: session.file } } : {}),
    }),
  )
}

export function resolvePath(path: string, session: Session): ResolvedPath {
  const parsed = parsePath(path, session.profile.allowParentSegments)
  if (!parsed.ok) dslFailure(session, 'HBS001', parsed.message, { path })
  return { emitted: parsed.emitted, parentHops: parentHops(parsed.segments) }
}

export function readArgument(arg: unknown, session: Session): SiteArgument {
  if (typeof arg === 'object' && arg !== null && 'kind' in arg && arg.kind === 'helper') {
    dslFailure(session, 'HBS002', 'Nested helper subexpressions are not supported.')
  }
  if (!isExpression(arg)) {
    dslFailure(session, 'HBS002', 'Helper argument has no expression kind.')
  }
  if (arg.kind === 'literal') return { kind: 'literal', emitted: emitLiteral(arg.value) }
  const path = resolvePath(arg.value, session)
  return { kind: 'path', emitted: path.emitted, path }
}
