export type OutputFormat = 'text' | 'json'

export type ParsedArgs =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'error'; format: OutputFormat; message: string; config?: string }
  | {
      kind: 'build'
      format: OutputFormat
      config?: string
      warningsAsErrors: boolean
      locale?: string
      emailId?: string
    }
  | {
      kind: 'validate'
      format: OutputFormat
      config?: string
      warningsAsErrors: boolean
    }
  | {
      kind: 'dev'
      format: OutputFormat
      config?: string
      warningsAsErrors: boolean
    }
  | {
      kind: 'preview'
      format: OutputFormat
      config?: string
      warningsAsErrors: boolean
      emailId: string
      fixtureId: string
      outDir: string
    }

const valued = new Set(['--config', '--format', '--locale', '--fixture', '--out'])

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let help = false
  let version = false
  let format: OutputFormat | undefined
  let config: string | undefined
  let locale: string | undefined
  let fixture: string | undefined
  let out: string | undefined
  let warningsAsErrors = false
  const seen = new Set<string>()
  const positionals: string[] = []
  const errors: string[] = []

  const tokens = argv.slice(2)
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ''
    if (token === '--help' || token === '-h') {
      help = true
      continue
    }
    if (token === '--version' || token === '-V') {
      version = true
      continue
    }
    if (token === '--warnings-as-errors') {
      if (seen.has(token)) errors.push(`Duplicate option: ${token}`)
      seen.add(token)
      warningsAsErrors = true
      continue
    }
    if (token.startsWith('-')) {
      if (!valued.has(token)) {
        errors.push(`Unknown option: ${token}`)
        continue
      }
      if (seen.has(token)) errors.push(`Duplicate option: ${token}`)
      seen.add(token)
      const value = tokens[index + 1]
      if (!value || value.startsWith('-')) {
        errors.push(`Option ${token} requires a value.`)
        continue
      }
      index += 1
      switch (token) {
        case '--config':
          config = value
          break
        case '--locale':
          locale = value
          break
        case '--fixture':
          fixture = value
          break
        case '--out':
          out = value
          break
        case '--format':
          if (value === 'text' || value === 'json') format = value
          else errors.push(`Invalid format: ${value}`)
          break
      }
      continue
    }
    positionals.push(token)
  }

  const resolvedFormat = format ?? 'text'
  const fail = (message: string): ParsedArgs => ({
    kind: 'error',
    format: resolvedFormat,
    message,
    ...(config ? { config } : {}),
  })
  if (errors.length > 0) return fail(errors.join('\n'))
  if (help) return { kind: 'help' }
  if (version) return { kind: 'version' }

  const [command, ...rest] = positionals
  const shared = {
    format: resolvedFormat,
    ...(config ? { config } : {}),
    warningsAsErrors,
  }
  switch (command) {
    case undefined:
      return fail('Missing command.')
    case 'build':
      if (fixture || out) return fail('--fixture and --out are only valid for preview.')
      if (rest.length > 1) return fail('build accepts at most one email id.')
      return {
        kind: 'build',
        ...shared,
        ...(locale ? { locale } : {}),
        ...(rest[0] ? { emailId: rest[0] } : {}),
      }
    case 'validate':
      if (rest.length > 0) return fail('validate does not accept an email id.')
      if (locale) return fail('--locale is only valid for build.')
      if (fixture || out) return fail('Unknown option for validate.')
      return { kind: 'validate', ...shared }
    case 'dev':
      if (rest.length > 0) return fail('dev does not accept an email id.')
      if (locale) return fail('--locale is only valid for build.')
      if (fixture || out) return fail('--fixture and --out are only valid for preview.')
      return { kind: 'dev', ...shared }
    case 'preview':
      if (locale) return fail('--locale is only valid for build.')
      if (rest.length !== 1) return fail('preview requires an email id.')
      if (!fixture) return fail('preview requires --fixture.')
      if (!out) return fail('preview requires --out.')
      return {
        kind: 'preview',
        ...shared,
        emailId: rest[0] ?? '',
        fixtureId: fixture,
        outDir: out,
      }
    default:
      return fail(`Unknown command: ${command}`)
  }
}

export function helpText(): string {
  return [
    'vtex-email build [email-id]',
    'vtex-email validate',
    'vtex-email dev',
    'vtex-email preview <email-id> --fixture <fixture-id> --out <directory>',
    '',
    'Options:',
    '  --config <path>',
    '  --format text|json',
    '  --warnings-as-errors',
    '  --locale <locale>    build only',
    '  -h, --help',
    '  -V, --version',
    '',
  ].join('\n')
}
