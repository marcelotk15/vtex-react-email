import { describe, expect, it } from 'vitest'

import type { PreviewEmail } from '../../contract'

import { filterEmails, visibleRows } from './tree'

const emails: PreviewEmail[] = [
  {
    id: 'order-confirmed',
    locales: ['pt-BR'],
    localePath: 'orders.0.clientPreferencesData.locale',
    fixtures: [
      {
        id: 'delivery',
        description: 'One order with an address',
        origin: 'synthetic',
        purpose: 'runtime',
        file: 'fixtures/order-confirmed/delivery.json',
        expectedLocale: 'en-US',
      },
      {
        id: 'pickup',
        description: 'Store pickup',
        origin: 'synthetic',
        purpose: 'branch',
        file: 'fixtures/order-confirmed/pickup.json',
      },
    ],
  },
  {
    id: 'auth-code',
    locales: ['pt-BR'],
    localePath: 'locale',
    fixtures: [
      {
        id: 'default',
        description: 'Login code',
        origin: 'synthetic',
        purpose: 'default',
        file: 'fixtures/auth-code/default.json',
      },
    ],
  },
]

describe('template tree', () => {
  it('matches an email by name and keeps every fixture', () => {
    const found = filterEmails(emails, 'auth')
    expect(found.map((email) => email.id)).toEqual(['auth-code'])
    expect(found[0]?.fixtures).toHaveLength(1)
  })

  it('matches a fixture by id or description and keeps the parent', () => {
    expect(filterEmails(emails, 'pickup').map((email) => email.fixtures.map((fixture) => fixture.id))).toEqual([
      ['pickup'],
    ])
    expect(filterEmails(emails, 'ADDRESS').flatMap((email) => email.fixtures.map((fixture) => fixture.id))).toEqual([
      'delivery',
    ])
  })

  it('returns no rows for a search with no match', () => {
    expect(visibleRows(emails, 'missing', new Set(['order-confirmed']))).toEqual([])
  })

  it('hides fixtures until the email is expanded, except while searching', () => {
    const collapsed = visibleRows(emails, '', new Set())
    expect(collapsed.map((row) => row.id)).toEqual(['email:order-confirmed', 'email:auth-code'])
    const open = visibleRows(emails, '', new Set(['auth-code']))
    expect(open.map((row) => row.kind)).toEqual(['email', 'email', 'fixture'])
    const searched = visibleRows(emails, 'delivery', new Set())
    expect(searched.map((row) => row.id)).toEqual(['email:order-confirmed', 'fixture:order-confirmed:delivery'])
  })
})
