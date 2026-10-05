import type { ReactNode } from 'react'

import { pixelBasedPreset, Section, Text } from '@react-email/components'
import { type EmissionProfile } from '@vtex-email/core'
import { evaluateArtifact } from '@vtex-email/core'
import { p0Profile } from '@vtex-email/vtex'
import { describe, expect, it } from 'vitest'

import { Email } from './adapter/email'
import { compileEmail } from './compile/compile-email'
import { Each, Eq, expr, Group, HasSubStr, If, IfCond, Unless, Vtex } from './dsl/vtex'

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

  it('rejects an invalid ifCond operator, @index outside each, and a bad group by', async () => {
    function BadOperator() {
      return (
        <Email>
          <IfCond operator={'>' as '=='} path="a" value="1">
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
})
