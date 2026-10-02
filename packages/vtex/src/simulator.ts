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

function replaceOnce(value: unknown, search: unknown, next: unknown): string {
  if (typeof value !== 'string' || typeof search !== 'string' || typeof next !== 'string') {
    throw new Error('replace: the local simulator expects three strings.')
  }
  const index = value.indexOf(search)
  if (index < 0) return value
  return value.slice(0, index) + next + value.slice(index + search.length)
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
  ],
}
