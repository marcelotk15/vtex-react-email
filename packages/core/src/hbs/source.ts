export function emitLiteral(value: string | number | boolean | null): string {
  if (typeof value === 'string') {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid numeric literal.')
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return 'null'
}

export function emitInterpolation(path: string): string {
  return `{{${path}}}`
}

export function emitHelperCall(name: string, args: readonly string[]): string {
  return `{{${name}${args.length > 0 ? ` ${args.join(' ')}` : ''}}}`
}

export function emitBlockOpen(name: string, args: readonly string[]): string {
  return `{{#${name}${args.length > 0 ? ` ${args.join(' ')}` : ''}}}`
}

export function emitBlockClose(name: string): string {
  return `{{/${name}}}`
}
