const brand: unique symbol = Symbol('vtex-email.expression')

export type Expression =
  | { readonly kind: 'path'; readonly value: string; readonly [brand]: true }
  | { readonly kind: 'literal'; readonly value: string | number | boolean | null; readonly [brand]: true }

export function isExpression(value: unknown): value is Expression {
  return typeof value === 'object' && value !== null && brand in value
}

export const expr = {
  path(value: string): Expression {
    return { kind: 'path', value, [brand]: true }
  },
  literal(value: string | number | boolean | null): Expression {
    return { kind: 'literal', value, [brand]: true }
  },
}
