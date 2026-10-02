import handlebarsImport from 'handlebars'

import type { Diagnostic } from './diagnostics'
import type { EmissionProfile, LocalSimulator } from './profile'

import { errorDiagnostic } from './diagnostics'
import { singleDocumentIssue } from './merge'
import { commitArtifacts } from './write'

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

export class TemplateFailure extends Error {
  readonly diagnostics: Diagnostic[]

  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics.map((item) => item.message).join('\n'))
    this.name = 'TemplateFailure'
    this.diagnostics = diagnostics
  }
}

const handlebars = handlebarsImport as unknown as HandlebarsApi

export function validateHandlebarsSyntax(source: string, knownHelperNames: readonly string[]): Diagnostic | null {
  const instance = handlebars.create()
  const knownHelpers: Record<string, boolean> = {}
  for (const name of knownHelperNames) knownHelpers[name] = true
  try {
    const generated = instance.precompile(source, {
      knownHelpersOnly: true,
      knownHelpers,
      noEscape: false,
    })
    if (typeof generated !== 'string') {
      return errorDiagnostic('HBS001', 'Handlebars precompilation did not return source text.')
    }
  } catch (error) {
    return handlebarsDiagnostic(error)
  }
  return null
}

export async function releaseArtifacts(input: {
  helperNames: readonly string[]
  directory: string
  files: ReadonlyArray<{ name: string; content: string }>
}): Promise<Diagnostic | null> {
  for (const file of input.files) {
    const issue = validateHandlebarsSyntax(file.content, input.helperNames)
    if (issue) return issue
  }
  await commitArtifacts(input.directory, input.files)
  return null
}

export function renderTemplate(source: string, data: unknown, simulator: LocalSimulator): string {
  const instance = handlebars.create()
  const knownHelpers: Record<string, boolean> = {}

  for (const helper of simulator.helpers) {
    knownHelpers[helper.name] = true
    if (helper.kind === 'inline') {
      const apply = helper.apply
      instance.registerHelper(helper.name, ((...args: unknown[]) => apply(...args.slice(0, -1))) as never)
    } else {
      const apply = helper.apply
      instance.registerHelper(helper.name, function (this: unknown, ...args: unknown[]) {
        const options = args.at(-1) as Parameters<typeof apply>[2]
        return apply(this, args.slice(0, -1), options)
      } as never)
    }
  }

  let template: (data: unknown) => string
  try {
    template = instance.compile(source, {
      knownHelpersOnly: true,
      knownHelpers,
      noEscape: false,
    })
  } catch (error) {
    throw new TemplateFailure([handlebarsDiagnostic(error)])
  }

  return template(data)
}

export function evaluateArtifact(input: {
  source: string
  data: unknown
  profile: EmissionProfile
  simulator: LocalSimulator
}): string {
  if (input.profile.id.length === 0) {
    throw new TemplateFailure([errorDiagnostic('HBS002', 'The emission profile has no id.')])
  }
  const html = renderTemplate(input.source, input.data, input.simulator)
  const issue = singleDocumentIssue(html)
  if (issue) throw new TemplateFailure([errorDiagnostic('HTML001', issue)])
  return html
}

export function syntaxHelperNames(profile: EmissionProfile): string[] {
  return profile.capabilities.filter((capability) => capability.form !== 'path').map((capability) => capability.name)
}

function handlebarsDiagnostic(error: unknown): Diagnostic {
  const message = error instanceof Error ? error.message : 'Failed to compile Handlebars.'
  const code = /helper/i.test(message) ? 'HBS002' : 'HBS001'
  return errorDiagnostic(code, message)
}
