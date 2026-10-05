import type { ReactNode } from 'react'

import { pixelBasedPreset, Section, Text } from '@react-email/components'
import { evaluateArtifact, type EmissionProfile } from '@vtex-email/core'
import { p0Profile } from '@vtex-email/vtex'
import { describe, expect, it } from 'vitest'

import { Email } from './adapter/email'
import { compileEmail } from './compile/compile-email'
import { Each, Eq, expr, Group, HasSubStr, If, IfCond, Math, RichShippingData, Unless, Vtex, With } from './dsl/vtex'

function compile(component: () => ReactNode, profile: EmissionProfile = p0Profile) {
  return compileEmail({
    email: { id: 'sample', event: 'sample', template: component },
    locale: 'pt-BR',
    catalog: { title: 'Title', empty: 'Empty', yes: 'Yes' },
    profile,
    tailwind: { presets: [pixelBasedPreset] },
  })
}

describe('P1 DSL', () => {
  it('emits unless, title, and a parent reference inside each', async () => {
    function View() {
      return (
        <Email>
          <Each path="orders">
            <Section>
              <Unless path="gift">
                <Text>
                  <Vtex.Value path="../seller" />
                </Text>
              </Unless>
              <Vtex.Link href="https://example.com/order" title={expr.path('name')}>
                open
              </Vtex.Link>
            </Section>
          </Each>
        </Email>
      )
    }

    const compiled = await compile(View)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const html = compiled.artifacts[0]?.content ?? ''
    expect(html).toContain('{{#unless gift}}')
    expect(html).toContain('{{../seller}}')
    expect(html).toContain('title="{{name}}"')
    expect(compiled.manifest.homologation).toBe('experimental')
    expect(compiled.manifest.capabilities.some((item) => item.name === 'unless')).toBe(true)
    expect(compiled.diagnostics.some((item) => item.code === 'TARGET001')).toBe(true)
    expect(compiled.manifest.locales).toEqual(['pt-BR'])
  })

  it('rejects a parent path at the root and in an each fallback', async () => {
    function AtRoot() {
      return (
        <Email>
          <Text>
            <Vtex.Value path="../orderId" />
          </Text>
        </Email>
      )
    }
    function InFallback() {
      return (
        <Email>
          <Each
            fallback={
              <Text>
                <Vtex.Value path="../name" />
              </Text>
            }
            path="items"
          >
            <Text>
              <Vtex.Value path="name" />
            </Text>
          </Each>
        </Email>
      )
    }

    for (const component of [AtRoot, InFallback]) {
      const compiled = await compile(component)
      expect(compiled.ok).toBe(false)
      if (compiled.ok) continue
      expect(compiled.diagnostics.some((item) => item.code === 'HBS001')).toBe(true)
      expect(compiled).not.toHaveProperty('artifacts')
    }
  })

  it('keeps the outer parent path inside an if that is nested in each', async () => {
    function Nested() {
      return (
        <Email>
          <Each path="orders">
            <Section>
              <If
                fallback={
                  <Text>
                    <Vtex.Value path="../seller" />
                  </Text>
                }
                path="show"
              >
                <Text>
                  <Vtex.Value path="id" />
                </Text>
              </If>
            </Section>
          </Each>
        </Email>
      )
    }
    const compiled = await compile(Nested)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    expect(compiled.artifacts[0]?.content).toContain('{{../seller}}')
  })

  it('rejects helper arity, a literal in a path slot, a subexpression, and className paths', async () => {
    function WrongArity() {
      return (
        <Email>
          <Text>
            <Vtex.Helper args={[expr.path('price'), expr.path('extra')]} name="formatCurrency" />
          </Text>
        </Email>
      )
    }
    function WrongKind() {
      return (
        <Email>
          <Text>
            <Vtex.Helper args={[expr.literal('8bd'), expr.literal('bd'), expr.literal(' days')]} name="replace" />
          </Text>
        </Email>
      )
    }
    function NestedHelper() {
      return (
        <Email>
          <Text>
            <Vtex.Helper args={[{ kind: 'helper', name: 'formatCurrency', args: [] }]} name="replace" />
          </Text>
        </Email>
      )
    }
    function ClassPath() {
      return (
        <Email>
          <Vtex.Link className={expr.path('name')} href="https://example.com">
            open
          </Vtex.Link>
        </Email>
      )
    }

    for (const component of [WrongArity, WrongKind, NestedHelper]) {
      const compiled = await compile(component)
      expect(compiled).toMatchObject({ ok: false })
      if (compiled.ok) continue
      expect(compiled.diagnostics[0]?.code).toBe('HBS002')
    }
    const className = await compile(ClassPath)
    expect(className.ok).toBe(false)
    if (className.ok) return
    expect(className.diagnostics[0]?.code).toBe('DSL002')
  })

  it('does not treat a simulator-only helper as an emission capability', async () => {
    const emission: EmissionProfile = {
      ...p0Profile,
      capabilities: p0Profile.capabilities.filter((item) => item.name !== 'formatCurrency'),
    }
    function LocalOnly() {
      return (
        <Email>
          <Text>
            <Vtex.Helper args={[expr.path('price')]} name="formatCurrency" />
          </Text>
        </Email>
      )
    }
    const compiled = await compile(LocalOnly, emission)
    expect(compiled.ok).toBe(false)
    if (compiled.ok) return
    expect(compiled.diagnostics[0]?.code).toBe('HBS002')
  })

  it('emits ifCond, hasSubStr, group, eq, formatDate, and @index', async () => {
    function View() {
      return (
        <Email>
          <Section>
            <IfCond fallback={<Text>other</Text>} operator="==" path="paymentSystemName" value="Promissory">
              <Text>cash</Text>
            </IfCond>
            <HasSubStr fallback={<Text>no</Text>} path="categoriesIds" value="/9293/">
              <Text>ticket</Text>
            </HasSubStr>
            <Group by="packageId" path="items">
              <Section>
                <Each path="items">
                  <Text>
                    <Vtex.Value path="@index" />
                    <Vtex.Helper args={[expr.path('../../dueDate')]} name="formatDate" />
                  </Text>
                </Each>
              </Section>
            </Group>
            <Each path="totals">
              <Section>
                <Eq fallback={<Text>skip</Text>} path="id" value="Items">
                  <Text>
                    <Vtex.Helper args={[expr.path('value')]} name="formatCurrency" />
                  </Text>
                </Eq>
              </Section>
            </Each>
          </Section>
        </Email>
      )
    }
    const compiled = await compile(View)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const html = compiled.artifacts[0]?.content ?? ''
    expect(html).toContain('{{#ifCond paymentSystemName "==" "Promissory"}}')
    expect(html).toContain('{{#hasSubStr categoriesIds "/9293/"}}')
    expect(html).toContain('{{#group items by="packageId"}}')
    expect(html).toContain('{{#eq id "Items"}}')
    expect(html).toContain('{{formatDate ../../dueDate}}')
    expect(html).toContain('{{@index}}')
    expect(html.includes('20000')).toBe(false)
  })

  it('emits path-versus-path eq, ifCond inequalities, and dynamic replace', async () => {
    function View() {
      return (
        <Email>
          <Section>
            <Each path="items">
              <Section>
                <Eq path="@index" right={expr.path('../itemIndex')}>
                  <Text>
                    <Vtex.Value path="name" />
                  </Text>
                </Eq>
              </Section>
            </Each>
            <IfCond fallback={<Text>one</Text>} operator=">" path="items.length" right={expr.literal(1)}>
              <Text>many</Text>
            </IfCond>
            <HasSubStr path="selectedSla" search={expr.path('addressId')}>
              <Text>pickup</Text>
            </HasSubStr>
            <Text>
              <Vtex.Helper
                args={[expr.path('url'), expr.literal('{Installment}'), expr.path('installments')]}
                name="replace"
              />
            </Text>
          </Section>
        </Email>
      )
    }
    const compiled = await compile(View)
    if (!compiled.ok) {
      // oxlint-disable-next-line vitest/no-conditional-expect
      expect.fail(compiled.diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'))
    }
    const html = compiled.artifacts[0]?.content ?? ''
    expect(html).toContain('{{#eq @index ../itemIndex}}')
    expect(html).toContain('{{#ifCond items.length ">" 1}}')
    expect(html).toContain('{{#hasSubStr selectedSla addressId}}')
    expect(html).toContain('{{replace url "{Installment}" installments}}')
  })

  it('emits with, math, formatTime, formatDateTime, and richShippingData', async () => {
    function View() {
      return (
        <Email>
          <Section>
            <With fallback={<Text>missing</Text>} path="pickupStoreInfo.address">
              <Text>
                <Vtex.Value path="street" />
              </Text>
            </With>
            <Math form="block" operator="+" path="index" right={expr.literal(1)} />
            <Text>
              <Vtex.Helper args={[expr.path('dueDate')]} name="formatTime" />
              <Vtex.Helper args={[expr.path('dueDate')]} name="formatDateTime" />
              <Math left={expr.path('index')} operator="+" right={1} />
            </Text>
            <RichShippingData path="shippingData">
              <Section>
                <Group by="packageId" path="logisticsInfo">
                  <Text>
                    <Vtex.Value path="value" />
                  </Text>
                </Group>
              </Section>
            </RichShippingData>
          </Section>
        </Email>
      )
    }
    const compiled = await compile(View)
    if (!compiled.ok) {
      // oxlint-disable-next-line vitest/no-conditional-expect
      expect.fail(compiled.diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'))
    }
    const html = compiled.artifacts[0]?.content ?? ''
    expect(html).toContain('{{#with pickupStoreInfo.address}}')
    expect(html).toContain('{{#math index "+" 1}}')
    expect(html).toContain('{{math index "+" 1}}')
    expect(html).toContain('{{formatTime dueDate}}')
    expect(html).toContain('{{formatDateTime dueDate}}')
    expect(html).toContain('{{#richShippingData shippingData}}')
    expect(html).toContain('{{#group logisticsInfo by="packageId"}}')
  })

  it('emits composite href and src attributes', async () => {
    function View() {
      return (
        <Email>
          <Section>
            <Vtex.Link href={['http://', expr.path('_accountInfo.HostName'), '.com.br']}>store</Vtex.Link>
            <Vtex.Img
              alt={expr.path('_accountInfo.TradingName')}
              height={80}
              src={[
                'http://licensemanager.vtex.com.br/api/site/pub/accounts/',
                expr.path('_accountInfo.Id'),
                '/logos/show',
              ]}
              style={{ maxHeight: 80 }}
              width={160}
            />
          </Section>
        </Email>
      )
    }
    const compiled = await compile(View)
    if (!compiled.ok) {
      // oxlint-disable-next-line vitest/no-conditional-expect
      expect.fail(compiled.diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'))
    }
    const html = compiled.artifacts[0]?.content ?? ''
    expect(html).toContain('href="http://{{_accountInfo.HostName}}.com.br"')
    expect(html).toContain(
      'src="http://licensemanager.vtex.com.br/api/site/pub/accounts/{{_accountInfo.Id}}/logos/show"',
    )
    expect(html).toContain('alt="{{_accountInfo.TradingName}}"')
  })

  it('rejects an invalid ifCond operator, @index outside each, and a bad group by', async () => {
    function BadOperator() {
      return (
        <Email>
          <IfCond operator={'&&' as '=='} path="a" value="1">
            <Text>x</Text>
          </IfCond>
        </Email>
      )
    }
    function IndexAtRoot() {
      return (
        <Email>
          <Text>
            <Vtex.Value path="@index" />
          </Text>
        </Email>
      )
    }
    function BadBy() {
      return (
        <Email>
          <Group by="package-id" path="items">
            <Text>x</Text>
          </Group>
        </Email>
      )
    }
    for (const [component, code] of [
      [BadOperator, 'HBS002'],
      [IndexAtRoot, 'HBS001'],
      [BadBy, 'HBS002'],
    ] as const) {
      const compiled = await compile(component)
      expect(compiled.ok).toBe(false)
      if (compiled.ok) continue
      expect(compiled.diagnostics.some((item) => item.code === code)).toBe(true)
    }
  })

  it('preserves parent context inside ifCond and evaluates two fixtures differently', async () => {
    function View() {
      return (
        <Email>
          <Each path="payments">
            <Section>
              <IfCond fallback={<Text>card</Text>} operator="==" path="paymentSystemName" value="Promissory">
                <Text>
                  <Vtex.Value path="../orderId" />
                </Text>
              </IfCond>
            </Section>
          </Each>
        </Email>
      )
    }
    const compiled = await compile(View)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const source = compiled.artifacts[0]?.content ?? ''
    expect(source).toContain('{{../orderId}}')
    const first = evaluateArtifact({
      source,
      data: { orderId: 'ORD-A', payments: [{ paymentSystemName: 'Promissory' }] },
      profile: p0Profile,
      simulator: p0Profile,
    })
    const second = evaluateArtifact({
      source,
      data: { orderId: 'ORD-B', payments: [{ paymentSystemName: 'Visa' }] },
      profile: p0Profile,
      simulator: p0Profile,
    })
    expect(first).toContain('ORD-A')
    expect(second).toContain('card')
    expect(first.includes('ORD-B')).toBe(false)
  })

  it('records the template file when a static URL is rejected', async () => {
    const compiled = await compileEmail({
      email: {
        id: 'sample',
        event: 'sample',
        template: () => (
          <Email>
            <Vtex.Link href="http://example.com">open</Vtex.Link>
          </Email>
        ),
      },
      locale: 'pt-BR',
      catalog: {},
      profile: p0Profile,
      tailwind: { presets: [pixelBasedPreset] },
      file: 'emails/sample.email.tsx',
    })
    expect(compiled.ok).toBe(false)
    if (compiled.ok) return
    expect(compiled.diagnostics[0]?.source?.file).toBe('emails/sample.email.tsx')
  })

  it('wraps author components without data-anchor and strips the host from the artifact', async () => {
    function Line() {
      return (
        <Text>
          <Vtex.Value path="name" />
        </Text>
      )
    }
    function View() {
      return (
        <Email>
          <Each path="items">
            <Line />
          </Each>
        </Email>
      )
    }

    const compiled = await compile(View)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const html = compiled.artifacts[0]?.content ?? ''
    expect(html).toContain('{{#each items}}')
    expect(html).toContain('{{name}}')
    expect(html.includes('data-anchor')).toBe(false)
    expect(html.includes('vtx-anchor')).toBe(false)
  })

  it('nests IfCond over Each without an intermediate Section', async () => {
    function View() {
      return (
        <Email>
          <IfCond operator=">" path="items.length" right={0}>
            <Each path="items">
              <Text>
                <Vtex.Value path="name" />
              </Text>
            </Each>
          </IfCond>
        </Email>
      )
    }

    const compiled = await compile(View)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const html = compiled.artifacts[0]?.content ?? ''
    expect(html).toContain('{{#ifCond items.length ">" 0}}')
    expect(html).toContain('{{#each items}}')
    expect(html.includes('data-anchor')).toBe(false)
    expect(compiled.diagnostics.some((item) => item.code === 'TOK001')).toBe(false)
  })

  it('keeps inline Eq inside Text balanced after restore', async () => {
    function View() {
      return (
        <Email>
          <Text>
            before
            <Eq path="kind" value="a">
              <span>A</span>
            </Eq>
            after
          </Text>
        </Email>
      )
    }

    const compiled = await compile(View)
    expect(compiled).toMatchObject({ ok: true })
    if (!compiled.ok) return
    const html = compiled.artifacts[0]?.content ?? ''
    expect(html).toContain('{{#eq kind "a"}}')
    expect(html).toContain('<span>A</span>')
    expect(html).toContain('{{/eq}}')
    expect(html.includes('vtx-anchor')).toBe(false)
  })
})
