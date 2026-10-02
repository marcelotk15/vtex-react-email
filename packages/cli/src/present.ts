import path from 'node:path'

interface ReportedDiagnostic {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  templateId?: string
  locale?: string
  fixtureId?: string
  path?: string
  origin?: string
  source?: { file: string; line?: number; column?: number }
}

interface ReportedManifest {
  formatVersion: 1
  homologation: 'experimental'
}

export interface CliDiagnostic {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  templateId?: string
  locale?: string
  fixtureId?: string
  path?: string
  origin?: string
  source?: { file: string; line?: number; column?: number }
}

export interface UnverifiedCapability {
  templateId: string
  name: string
  evidence: string
  severity: 'error' | 'warning'
}

export interface CliReport {
  formatVersion: 1
  command: 'build' | 'validate' | 'preview' | 'usage'
  ok: boolean
  exitCode: 0 | 1 | 2
  diagnostics: CliDiagnostic[]
  manifest: ReportedManifest | null
  wrote: string[]
  preserved: string[]
  unverifiedCapabilities: UnverifiedCapability[]
}

export function publishDiagnostics(diagnostics: readonly ReportedDiagnostic[], configDir: string): CliDiagnostic[] {
  return diagnostics.map((item) => publicDiagnostic(item, configDir))
}

export function buildReport(input: {
  command: CliReport['command']
  ok: boolean
  exitCode: 0 | 1 | 2
  diagnostics: readonly ReportedDiagnostic[]
  manifest: ReportedManifest | null
  wrote: readonly string[]
  preserved: readonly string[]
  configDir: string
}): CliReport {
  const diagnostics = input.diagnostics.map((item) => publicDiagnostic(item, input.configDir))
  return {
    formatVersion: 1,
    command: input.command,
    ok: input.ok,
    exitCode: input.exitCode,
    diagnostics,
    manifest: input.manifest,
    wrote: [...input.wrote],
    preserved: [...input.preserved],
    unverifiedCapabilities: unverifiedCapabilities(diagnostics),
  }
}

export function reportJson(report: CliReport): string {
  return `${JSON.stringify(report)}\n`
}

export function reportText(report: CliReport): string {
  const lines: string[] = []
  if (report.manifest?.homologation === 'experimental') lines.push('homologation experimental')
  for (const item of report.diagnostics) {
    const where = [item.templateId, item.locale, item.fixtureId, item.origin].filter((part) => part && part.length > 0)
    lines.push([item.code, item.severity, ...where, item.message].join(' '))
  }
  for (const capability of report.unverifiedCapabilities) {
    lines.push(`unverified ${capability.templateId} ${capability.name} ${capability.evidence} ${capability.severity}`)
  }
  if (report.wrote.length > 0) lines.push(`wrote ${report.wrote.join(' ')}`)
  if (report.preserved.length > 0) lines.push(`preserved ${report.preserved.join(' ')}`)
  if (lines.length === 0) lines.push(report.ok ? 'ok' : 'failed')
  return `${lines.join('\n')}\n`
}

function publicDiagnostic(item: ReportedDiagnostic, configDir: string): CliDiagnostic {
  const diagnostic: CliDiagnostic = {
    code: item.code,
    severity: item.severity,
    message: scrub(item.message, configDir),
  }
  if (item.templateId) diagnostic.templateId = item.templateId
  if (item.locale) diagnostic.locale = item.locale
  if (item.fixtureId) diagnostic.fixtureId = item.fixtureId
  if (item.origin) diagnostic.origin = item.origin
  if (item.path) diagnostic.path = scrub(item.path, configDir)
  if (item.source?.file) {
    diagnostic.source = {
      file: relativeFile(item.source.file, configDir),
      ...(typeof item.source.line === 'number' ? { line: item.source.line } : {}),
      ...(typeof item.source.column === 'number' ? { column: item.source.column } : {}),
    }
  }
  return diagnostic
}

function unverifiedCapabilities(diagnostics: readonly CliDiagnostic[]): UnverifiedCapability[] {
  const map = new Map<string, UnverifiedCapability>()
  for (const item of diagnostics) {
    if (item.code !== 'TARGET001' || !item.templateId) continue
    const matched = /^Capability (\S+) is (\S+) /.exec(item.message)
    if (!matched?.[1] || !matched[2]) continue
    const severity = item.severity === 'error' ? 'error' : 'warning'
    const key = `${item.templateId}\0${matched[1]}`
    const current = map.get(key)
    if (!current || severity === 'error') {
      map.set(key, { templateId: item.templateId, name: matched[1], evidence: matched[2], severity })
    }
  }
  return [...map.values()]
}

function relativeFile(file: string, configDir: string): string {
  if (!path.isAbsolute(file)) return file.split(path.sep).join('/')
  const relative = path.relative(configDir, file)
  if (relative.length === 0 || relative.startsWith('..') || path.isAbsolute(relative)) return path.basename(file)
  return relative.split(path.sep).join('/')
}

function scrub(value: string, configDir: string): string {
  if (configDir.length === 0) return value
  const prefix = configDir.endsWith(path.sep) ? configDir : `${configDir}${path.sep}`
  return value.split(prefix).join('').split(configDir).join('.')
}
