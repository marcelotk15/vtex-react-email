import { parseMessage } from '@vtex-email/core'

import { getSession } from '../compile/session'
import { type Expression } from './expr'
import { dslFailure } from './resolve'
import { textLiteral, textValue } from './values'

export function Trans({ id, values }: { id: string; values?: Readonly<Record<string, Expression>> }) {
  const session = getSession()
  const text = session.catalog[id]
  if (text === undefined) {
    dslFailure(session, 'I18N001', `Missing key: ${id}`, { locale: session.locale })
  }
  const parsed = parseMessage(text)
  if (!parsed.ok) {
    dslFailure(session, 'I18N001', parsed.message, { locale: session.locale })
  }
  const provided = Object.keys(values ?? {}).sort()
  const expected = parsed.placeholders.slice().sort()
  if (provided.join('\0') !== expected.join('\0')) {
    dslFailure(session, 'I18N001', `Placeholders for ${id} do not match the catalog.`, { locale: session.locale })
  }
  return (
    <>
      {parsed.parts.map((part) => {
        if (part.type === 'text') return part.value
        const value = values?.[part.name]
        if (!value) {
          dslFailure(session, 'I18N001', `Missing placeholder value: ${part.name}`, { locale: session.locale })
        }
        if (value.kind === 'literal') return textLiteral(value.value)
        return textValue(value.value)
      })}
    </>
  )
}
