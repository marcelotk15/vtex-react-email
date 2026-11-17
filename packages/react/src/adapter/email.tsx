import type { CSSProperties, ReactNode } from 'react'

import { Body, Head, Html, Tailwind } from '@react-email/components'

import { getSession } from '../compile/session'

export interface EmailProps {
  children: ReactNode
  className?: string
  /** Extra nodes for `<head>` (`<title>`, `<style>`, font `<link>`s). Rendered after the React Email defaults. */
  head?: ReactNode
  /** Extra attributes for `<html>` (for example `xmlns:o` for Outlook). `lang` defaults to the compiled locale. */
  htmlAttributes?: Readonly<Record<string, string>>
  /** Inline style for `<body>`. */
  bodyStyle?: CSSProperties
  /**
   * React Email wraps the body content in a full-width presentation table and moves the body style to its cell.
   * `false` writes a plain `<body>` with `bodyStyle` on it, for migrations that must keep an existing structure.
   */
  bodyTable?: boolean
  /**
   * Document type declaration. Defaults to React Email's XHTML 1.0 Transitional (standards-like rendering).
   * `null` writes none, which puts browsers and WebKit-based clients in quirks mode; use it only to keep the
   * rendering of a legacy template that shipped without a doctype.
   */
  doctype?: string | null
}

export function Email({ children, className, head, htmlAttributes, bodyStyle, bodyTable = true, doctype }: EmailProps) {
  const session = getSession()
  if (doctype !== undefined) session.doctype = doctype
  return (
    <Html lang={session.locale} {...htmlAttributes}>
      <Tailwind config={session.tailwind}>
        <Head>{head}</Head>
        {bodyTable ? (
          <Body className={className} {...(bodyStyle ? { style: bodyStyle } : {})}>
            {children}
          </Body>
        ) : (
          <body className={className} style={bodyStyle}>
            {children}
          </body>
        )}
      </Tailwind>
    </Html>
  )
}
