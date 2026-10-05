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

function parseDate(value: unknown, helper: string): Date {
  const date = value instanceof Date ? value : new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${helper}: the local simulator expects a Date-parseable value.`)
  }
  return date
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDate(value: unknown): string {
  const date = parseDate(value, 'formatDate')
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatTime(value: unknown): string {
  const date = parseDate(value, 'formatTime')
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function formatDateTime(value: unknown): string {
  const date = parseDate(value, 'formatDateTime')
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
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

function compareValues(left: unknown, operator: unknown, right: unknown): boolean | null {
  switch (operator) {
    case '==':
      return left == right
    case '===':
      return left === right
    case '!=':
      return left != right
    case '<':
      return (left as never) < (right as never)
    case '<=':
      return (left as never) <= (right as never)
    case '>':
      return (left as never) > (right as never)
    case '>=':
      return (left as never) >= (right as never)
    default:
      return null
  }
}

function applyMath(left: unknown, operator: unknown, right: unknown): string {
  const lvalue = Number.parseFloat(String(left))
  const rvalue = Number.parseFloat(String(right))
  const result = (
    {
      '+': lvalue + rvalue,
      '-': lvalue - rvalue,
      '*': lvalue * rvalue,
      '/': lvalue / rvalue,
      '%': lvalue % rvalue,
    } as Record<string, number>
  )[String(operator)]
  if (result === undefined || !Number.isFinite(result)) {
    throw new Error('math: the local simulator expects a finite numeric result.')
  }
  return String(result)
}

const estimatePattern = /^(\d+)(m|h|d|bd)$/

function enrichLogisticsItem(item: Record<string, unknown>): Record<string, unknown> {
  const next = { ...item }
  const selected = item.selectedSla
  const slas = Array.isArray(item.slas) ? item.slas : []
  for (const sla of slas) {
    if (!sla || typeof sla !== 'object') continue
    const row = sla as Record<string, unknown>
    if (item.selectedSla !== row.id) continue
    const estimate = typeof row.shippingEstimate === 'string' ? row.shippingEstimate : ''
    const match = estimatePattern.exec(estimate)
    next.packageId = `${String(row.id ?? '')}${String(row.shippingEstimateDate ?? '')}${estimate}`
    next.shippingEstimateDays = match ? match[1] : estimate
    next.shippingEstimateDaysType = match ? match[2] : null
    next.shippingEstimate = row.shippingEstimate
    next.shippingEstimateDate = row.shippingEstimateDate
    next.deliveryWindow = row.deliveryWindow
    next.availableDeliveryWindows = row.availableDeliveryWindows
    void selected
    break
  }
  return next
}

function richShippingData(
  _context: unknown,
  values: unknown[],
  options: { fn: (context: unknown) => string; inverse: (context: unknown) => string },
): string {
  const shipping = values[0]
  if (shipping == null || typeof shipping !== 'object') return options.inverse(_context)
  const source = shipping as Record<string, unknown>
  const logistics = Array.isArray(source.logisticsInfo) ? source.logisticsInfo : []
  const enriched = logistics.map((item) =>
    item && typeof item === 'object' ? enrichLogisticsItem(item as Record<string, unknown>) : item,
  )
  const sorted = [...enriched].sort((left, right) => {
    const a =
      left && typeof left === 'object' ? Number((left as Record<string, unknown>).shippingEstimateDays) : Number.NaN
    const b =
      right && typeof right === 'object' ? Number((right as Record<string, unknown>).shippingEstimateDays) : Number.NaN
    const leftValue = Number.isFinite(a) ? a : Number.POSITIVE_INFINITY
    const rightValue = Number.isFinite(b) ? b : Number.POSITIVE_INFINITY
    return leftValue - rightValue
  })
  return options.fn({ ...source, logisticsInfo: sorted })
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
      name: 'formatTime',
      kind: 'inline',
      evidence: 'experimental',
      note: 'Local HH:mm with zero padding. Not verified on VTEX.',
      apply: formatTime,
    },
    {
      name: 'formatDateTime',
      kind: 'inline',
      evidence: 'experimental',
      note: 'Local dd/MM/yyyy HH:mm:ss with zero padding. Not verified on VTEX.',
      apply: formatDateTime,
    },
    {
      name: 'replace',
      kind: 'inline',
      evidence: 'documented',
      note: 'One occurrence. A path and two expressions that resolve to strings.',
      apply: replaceOnce,
    },
    {
      name: 'math',
      kind: 'inline',
      evidence: 'experimental',
      note: 'Local arithmetic. Not verified on VTEX.',
      apply: applyMath,
    },
    {
      name: 'eq',
      kind: 'block',
      evidence: 'experimental',
      note: 'Local strict equality. Path versus path or literal. Not verified on VTEX.',
      apply: (context, values, options) => {
        const [left, right] = values
        return left === right ? options.fn(context) : options.inverse(context)
      },
    },
    {
      name: 'ifCond',
      kind: 'block',
      evidence: 'experimental',
      note: 'Local ==, ===, !=, <, <=, >, and >=. Not verified on VTEX.',
      apply: (context, values, options) => {
        const [left, operator, right] = values
        const pass = compareValues(left, operator, right)
        if (pass === null) return options.inverse(context)
        return pass ? options.fn(context) : options.inverse(context)
      },
    },
    {
      name: 'hasSubStr',
      kind: 'block',
      evidence: 'experimental',
      note: 'Local substring check. Search may be a path or literal. Not verified on VTEX.',
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
    {
      name: 'with',
      kind: 'block',
      evidence: 'experimental',
      note: 'Local Handlebars with. Not verified on VTEX.',
      apply: (context, values, options) => {
        const target = values[0]
        if (!target) return options.inverse(context)
        return options.fn(target)
      },
    },
    {
      name: 'richShippingData',
      kind: 'block',
      evidence: 'experimental',
      note: 'Clones shippingData before deriving SLA fields. Not verified on VTEX.',
      apply: richShippingData,
    },
  ],
}
