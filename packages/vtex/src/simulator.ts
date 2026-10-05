import type { LocalSimulator } from '@vtex-email/core'

function formatCurrency(value: unknown): string {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('formatCurrency: the local simulator expects integer cents.')
  }
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  const units = Math.trunc(absolute / 100)
  const cents = String(absolute % 100).padStart(2, '0')
  return `${sign}${units},${cents}`
}

function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) {
    throw new Error('formatDate: the local simulator expects a Date-parseable value.')
  }
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day}/${month}/${year}`
}

function replaceOnce(value: unknown, search: unknown, next: unknown): string {
  if (typeof value !== 'string' || typeof search !== 'string' || typeof next !== 'string') {
    throw new Error('replace: the local simulator expects three strings.')
  }
  const index = value.indexOf(search)
  if (index < 0) return value
  return value.slice(0, index) + next + value.slice(index + search.length)
}

function readProperty(obj: unknown, prop: string): unknown {
  const parts = prop.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export const messageCenterSimulator: LocalSimulator = {
  helpers: [
    {
      name: 'formatCurrency',
      kind: 'inline',
      evidence: 'documented',
      note: '20000 -> 200,00 is documented. Other integers are a local contract.',
      apply: formatCurrency,
    },
    {
      name: 'formatDate',
      kind: 'inline',
      evidence: 'experimental',
      note: 'Local dd/MM/yyyy. Not verified on VTEX.',
      apply: formatDate,
    },
    {
      name: 'replace',
      kind: 'inline',
      evidence: 'documented',
      note: 'One occurrence. A path and two literals.',
      apply: replaceOnce,
    },
    {
      name: 'eq',
      kind: 'block',
      evidence: 'experimental',
      note: 'Local strict equality. Not verified on VTEX.',
      apply: (context, values, options) => {
        const [left, right] = values
        return left === right ? options.fn(context) : options.inverse(context)
      },
    },
    {
      name: 'ifCond',
      kind: 'block',
      evidence: 'experimental',
      note: 'Local ==, ===, and !=. Not verified on VTEX.',
      apply: (context, values, options) => {
        const [left, operator, right] = values
        let pass = false
        if (operator === '==') pass = left == right
        else if (operator === '===') pass = left === right
        else if (operator === '!=') pass = left != right
        else return options.inverse(context)
        return pass ? options.fn(context) : options.inverse(context)
      },
    },
    {
      name: 'hasSubStr',
      kind: 'block',
      evidence: 'experimental',
      note: 'Local substring check. Not verified on VTEX.',
      apply: (context, values, options) => {
        const [value, search] = values
        if (value != null && String(value).includes(String(search))) return options.fn(context)
        return options.inverse(context)
      },
    },
    {
      name: 'group',
      kind: 'block',
      evidence: 'experimental',
      note: 'Local array grouping by hash.by. Not verified on VTEX.',
      apply: (context, values, options) => {
        const list = values[0]
        const prop = options.hash.by
        if (typeof prop !== 'string' || prop.length === 0 || !Array.isArray(list) || list.length === 0) {
          return options.inverse(context)
        }
        const keys: unknown[] = []
        const groups = new Map<unknown, { index: number; value: unknown; items: unknown[] }>()
        for (const item of list) {
          const key = readProperty(item, prop)
          if (!groups.has(key)) {
            const group = { index: keys.length, value: key, items: [] as unknown[] }
            keys.push(key)
            groups.set(key, group)
          }
          groups.get(key)?.items.push(item)
        }
        let buffer = ''
        for (const key of keys) {
          const group = groups.get(key)
          if (group) buffer += options.fn(group)
        }
        return buffer
      },
    },
  ],
}
