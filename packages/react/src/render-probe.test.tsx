import {
  Body,
  Button,
  Column,
  Head,
  Html,
  Img,
  Link,
  pixelBasedPreset,
  render,
  Row,
  Section,
  Tailwind,
  Text,
} from '@react-email/components'
import { AsyncLocalStorage } from 'node:async_hooks'
import { parse, type DefaultTreeAdapterMap } from 'parse5'
import { type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

const TOKEN_TD = 'vtxPROBEInsideTd00001'
const TOKEN_BETWEEN = 'vtxPROBEBetweenRows1'
const TOKEN_HREF = 'vtxPROBEHrefValue0001'
const TOKEN_SRC = 'vtxPROBESrcValue00001'
const TOKEN_ALT = 'vtxPROBEAltValue00001'
const TOKEN_BUTTON = 'vtxPROBEButtonChild01'
const FIXTURE_SENTINEL = 'ProbeSentinelMustNotAppear'

const locales = new AsyncLocalStorage<string>()
const componentCalls = { badge: 0 }

function Badge() {
  // Counts renders of a probe component. The increment is the measurement, not view state.
  // oxlint-disable-next-line react/immutability
  componentCalls.badge += 1
  return <Text className="text-sm text-gray-700">badge</Text>
}

function LocaleMark() {
  return <Text>{locales.getStore() ?? 'MISSING'}</Text>
}

function shell(children: ReactNode, bodyClass: string) {
  return (
    <Html>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Body className={bodyClass}>{children}</Body>
      </Tailwind>
    </Html>
  )
}

type HtmlNode = DefaultTreeAdapterMap['node']
type ParentNode = DefaultTreeAdapterMap['parentNode']

function findTextParent(html: string, token: string): string | null {
  const document = parse(html)
  let parentName: string | null = null

  const visit = (node: HtmlNode, parent: ParentNode | null) => {
    if (node.nodeName === '#text' && 'value' in node && node.value.includes(token)) {
      parentName = parent?.nodeName ?? null
    }
    if ('childNodes' in node) {
      for (const child of node.childNodes) visit(child, node)
    }
  }

  visit(document, null)
  return parentName
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let index = 0
  while (index >= 0) {
    index = haystack.indexOf(needle, index)
    if (index === -1) break
    count += 1
    index += needle.length
  }
  return count
}

describe('React Email render probe', () => {
  it('keeps tokens, styles, and the async context', async () => {
    componentCalls.badge = 0
    const fixture = { customer: FIXTURE_SENTINEL }

    const html = await render(
      shell(
        <>
          <Badge />
          <Section className="mx-auto w-full max-w-[600px] bg-white p-6 sm:p-4">
            <Row>
              <Column>
                <Text className="m-0 text-sm text-gray-700">{TOKEN_TD}</Text>
                <Link href={TOKEN_HREF}>view</Link>
                <Img alt={TOKEN_ALT} height={96} src={TOKEN_SRC} width={96} />
                <Button className="bg-brand px-6 py-3 text-white" href="https://example.com">
                  {TOKEN_BUTTON}
                </Button>
              </Column>
            </Row>
          </Section>
          <table>
            <tbody>
              <tr>
                <td>before</td>
              </tr>
              {TOKEN_BETWEEN}
              <tr>
                <td>after</td>
              </tr>
            </tbody>
          </table>
        </>,
        'm-0 bg-gray-100 font-sans',
      ),
      { pretty: false },
    )

    const tdParent = findTextParent(html, TOKEN_TD)
    const betweenParent = findTextParent(html, TOKEN_BETWEEN)
    const buttonCopies = countOccurrences(html, TOKEN_BUTTON)
    const styleStart = html.indexOf('<style')
    const styleEnd = html.indexOf('</style>')
    const styleBlock = styleStart >= 0 && styleEnd > styleStart ? html.slice(styleStart, styleEnd) : ''
    const sanitizedPaddingClass = styleBlock.match(/\.([a-zA-Z0-9_-]*p-4)/)?.[1] ?? null

    const coldA = await locales.run('locale-aaa', () =>
      render(shell(<LocaleMark />, 'bg-[#112233]'), { pretty: false }),
    )
    const coldB = await locales.run('locale-bbb', () =>
      render(shell(<LocaleMark />, 'bg-[#445566]'), { pretty: false }),
    )
    const [warmA, warmB] = await Promise.all([
      locales.run('locale-ccc', () => render(shell(<LocaleMark />, 'bg-[#112233]'), { pretty: false })),
      locales.run('locale-ddd', () => render(shell(<LocaleMark />, 'bg-[#445566]'), { pretty: false })),
    ])

    const report = {
      badgeCalls: componentCalls.badge,
      tokens: {
        td: html.includes(TOKEN_TD),
        betweenRaw: html.includes(TOKEN_BETWEEN),
        href: html.includes(`href="${TOKEN_HREF}"`),
        src: html.includes(`src="${TOKEN_SRC}"`),
        alt: html.includes(`alt="${TOKEN_ALT}"`),
        button: html.includes(TOKEN_BUTTON),
      },
      parents: { td: tdParent, between: betweenParent },
      buttonCopies,
      mso: html.includes('<!--[if mso]>'),
      buttonSnippet: html.slice(
        Math.max(0, html.indexOf(TOKEN_BUTTON) - 180),
        html.indexOf(TOKEN_BUTTON) + TOKEN_BUTTON.length + 80,
      ),
      pixels: html.includes('14px'),
      media: styleBlock.includes('@media'),
      sanitizedPaddingClass,
      styleSnippet: styleBlock.slice(0, 500),
      fixtureLeak: html.includes(FIXTURE_SENTINEL) || html.includes(fixture.customer),
      locales: {
        coldA: coldA.includes('locale-aaa'),
        coldB: coldB.includes('locale-bbb'),
        warmA: warmA.includes('locale-ccc'),
        warmB: warmB.includes('locale-ddd'),
        warmAColor: warmA.includes('17,34,51') || warmA.includes('#112233'),
        warmBColor: warmB.includes('68,85,102') || warmB.includes('#445566'),
        warmAMixed: warmA.includes('68,85,102') || warmA.includes('#445566'),
        warmBMixed: warmB.includes('17,34,51') || warmB.includes('#112233'),
      },
    }

    console.log(`PROBE_REPORT ${JSON.stringify(report)}`)

    expect(report.badgeCalls).toBe(1)
    expect(report.tokens).toEqual({
      td: true,
      betweenRaw: true,
      href: true,
      src: true,
      alt: true,
      button: true,
    })
    expect(report.parents.td).toBe('p')
    expect(report.parents.between).toBe('td')
    expect(report.buttonCopies).toBe(1)
    expect(report.mso).toBe(true)
    expect(html.slice(html.indexOf(TOKEN_BUTTON), html.indexOf(TOKEN_BUTTON) + TOKEN_BUTTON.length)).toBe(TOKEN_BUTTON)
    expect(report.pixels).toBe(true)
    expect(report.media).toBe(true)
    expect(report.sanitizedPaddingClass).toBeTruthy()
    expect(html).toContain(report.sanitizedPaddingClass)
    expect(report.fixtureLeak).toBe(false)
    expect(report.locales.coldA).toBe(true)
    expect(report.locales.coldB).toBe(true)
    expect(report.locales.warmA).toBe(true)
    expect(report.locales.warmB).toBe(true)
    expect(report.locales.warmAMixed).toBe(false)
    expect(report.locales.warmBMixed).toBe(false)
  })

  it('anchors elements at the offsets of the original string', async () => {
    const anchor = 'vtxANCHOR000000000001'
    const href = 'vtxHREFANCHOR000000001'
    const html = await render(
      shell(
        <>
          <span data-vtx={anchor}>value</span>
          <Link href={href}>view</Link>
        </>,
        'm-0',
      ),
      { pretty: false },
    )
    const document = parse(html, { sourceCodeLocationInfo: true })
    const found: { anchor: string | null; href: string | null } = { anchor: null, href: null }

    const visit = (node: HtmlNode) => {
      if ('attrs' in node && node.sourceCodeLocation && 'tagName' in node) {
        const data = node.attrs.find((attr) => attr.name === 'data-vtx')
        const hrefAttr = node.attrs.find((attr) => attr.name === 'href')
        const location = node.sourceCodeLocation
        if (data?.value === anchor && location) {
          found.anchor = html.slice(location.startOffset, location.endOffset)
        }
        const hrefLocation = location?.attrs?.href
        if (hrefAttr?.value === href && hrefLocation) {
          found.href = html.slice(hrefLocation.startOffset, hrefLocation.endOffset)
        }
      }
      if ('childNodes' in node) {
        for (const child of node.childNodes) visit(child)
      }
    }

    visit(document)

    expect(found.anchor).toContain(`data-vtx="${anchor}"`)
    expect(found.anchor?.startsWith('<span')).toBe(true)
    expect(found.anchor?.endsWith('</span>')).toBe(true)
    expect(found.href).toContain(href)
    expect(html.split(anchor)).toHaveLength(2)
  })
})
