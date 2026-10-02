import type { EmissionProfile, LocalSimulator, Profile } from '@vtex-email/core'

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

export const messageCenterEmission: EmissionProfile = {
  id: 'p0-message-center-experimental',
  allowParentSegments: true,
  capabilities: [
    {
      name: 'each',
      form: 'block',
      evidence: 'documented',
      note: 'Native Handlebars helper. The item context replaces the current context. The fallback uses the outer context.',
      context: 'item',
      elseContext: 'outer',
    },
    {
      name: 'if',
      form: 'block',
      evidence: 'documented',
      note: 'Handlebars truthiness. 0, an empty string, and an empty array are false. The toolchain does not use Boolean(). Both branches keep the current context.',
      context: 'preserve',
      elseContext: 'preserve',
    },
    {
      name: 'unless',
      form: 'block',
      evidence: 'documented',
      note: 'Negation of if. Both branches keep the current context.',
      context: 'preserve',
      elseContext: 'preserve',
    },
    {
      name: '../',
      form: 'path',
      evidence: 'documented',
      note: 'Parent segment documented by Handlebars. A path cannot climb above the template root.',
    },
    {
      name: 'formatCurrency',
      form: 'inline',
      evidence: 'documented',
      note: 'VTEX documents 20000 as 200,00, without a symbol. Other integers follow the same local simulator, without verified parity.',
      arity: { min: 1, max: 1 },
      args: ['path'],
    },
    {
      name: 'replace',
      form: 'inline',
      evidence: 'documented',
      note: 'The official example replaces one occurrence of a literal in a path. The simulator follows that arity.',
      arity: { min: 3, max: 3 },
      args: ['path', 'literal', 'literal'],
    },
    {
      name: 'eq',
      form: 'block',
      evidence: 'experimental',
      note: 'The official example compares two paths. Comparing against a literal is a local simulator until Message Center verification. The DSL does not emit eq.',
      context: 'preserve',
      elseContext: 'preserve',
    },
  ],
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

export const p0Profile: Profile = {
  ...messageCenterEmission,
  helpers: messageCenterSimulator.helpers,
}
