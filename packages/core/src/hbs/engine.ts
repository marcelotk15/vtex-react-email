import handlebarsImport from 'handlebars'

import type { Diagnostic } from '../diagnostics'

import { errorDiagnostic } from '../diagnostics'

interface HandlebarsCompileOptions {
  knownHelpersOnly: boolean
  knownHelpers: Record<string, boolean>
  noEscape: boolean
}

interface HandlebarsInstance {
  registerHelper(name: string, fn: (...args: never[]) => unknown): void
  compile(source: string, options: HandlebarsCompileOptions): (data: unknown) => string
  precompile(source: string, options: HandlebarsCompileOptions): string
}

interface HandlebarsApi {
  create: () => HandlebarsInstance
}

const handlebars = handlebarsImport as unknown as HandlebarsApi

export function createHandlebars(): HandlebarsInstance {
  return handlebars.create()
}

export function compileOptions(knownHelperNames: readonly string[]): HandlebarsCompileOptions {
  const knownHelpers: Record<string, boolean> = {}
  for (const name of knownHelperNames) knownHelpers[name] = true
  return { knownHelpersOnly: true, knownHelpers, noEscape: false }
}

export function handlebarsDiagnostic(error: unknown): Diagnostic {
  const message = error instanceof Error ? error.message : 'Failed to compile Handlebars.'
  const code = /helper/i.test(message) ? 'HBS002' : 'HBS001'
  return errorDiagnostic(code, message)
}
