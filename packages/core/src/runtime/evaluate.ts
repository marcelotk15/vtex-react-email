import type { Diagnostic } from '../diagnostics'
import type { EmissionProfile, LocalSimulator } from '../profile'

import { errorDiagnostic } from '../diagnostics'
import { compileOptions, createHandlebars, handlebarsDiagnostic } from '../hbs/engine'
import { singleDocumentIssue } from './document'

export class TemplateFailure extends Error {
  readonly diagnostics: Diagnostic[]

  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics.map((item) => item.message).join('\n'))
    this.name = 'TemplateFailure'
    this.diagnostics = diagnostics
  }
}

export function renderTemplate(source: string, data: unknown, simulator: LocalSimulator): string {
  const instance = createHandlebars()
  const options = compileOptions(simulator.helpers.map((helper) => helper.name))

  for (const helper of simulator.helpers) {
    if (helper.kind === 'inline') {
      const apply = helper.apply
      instance.registerHelper(helper.name, ((...args: unknown[]) => apply(...args.slice(0, -1))) as never)
    } else {
      const apply = helper.apply
      instance.registerHelper(helper.name, function (this: unknown, ...args: unknown[]) {
        const blockOptions = args.at(-1) as Parameters<typeof apply>[2]
        return apply(this, args.slice(0, -1), blockOptions)
      } as never)
    }
  }

  let template: (data: unknown) => string
  try {
    template = instance.compile(source, options)
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
