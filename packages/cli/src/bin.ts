#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { helpText, parseArgs, type ParsedArgs } from './args'
import { buildReport, reportJson, reportText, type CliReport } from './present'
import { buildProject, exitOk, exitUsage, exportPreview, validateProject, type ProjectResult } from './project'

const parsed = parseArgs(process.argv)
const code = await run(parsed, process.cwd())
process.exit(code)

async function run(args: ParsedArgs, cwd: string): Promise<number> {
  if (args.kind === 'help') {
    await write(process.stdout, helpText())
    return exitOk
  }
  if (args.kind === 'version') {
    await write(process.stdout, `${packageVersion()}\n`)
    return exitOk
  }
  const configPath = path.resolve(cwd, args.config ?? 'vtex-email.config.ts')
  const configDir = path.dirname(configPath)
  if (args.kind === 'dev') return startDevCommand(configPath, configDir, args)
  if (args.kind === 'error') {
    const report = buildReport({
      command: 'usage',
      ok: false,
      exitCode: exitUsage,
      diagnostics: [{ code: 'CFG001', severity: 'error', message: args.message }],
      manifest: null,
      wrote: [],
      preserved: [],
      configDir,
    })
    await emit(report, args.format)
    return exitUsage
  }
  if (args.kind === 'preview') {
    const preview = await exportPreview({
      configPath,
      emailId: args.emailId,
      fixtureId: args.fixtureId,
      outDir: path.resolve(cwd, args.outDir),
      ...(args.warningsAsErrors ? { warningsAsErrors: true } : {}),
    })
    const report = buildReport({
      command: 'preview',
      ok: preview.ok,
      exitCode: preview.exitCode,
      diagnostics: preview.diagnostics,
      manifest: null,
      wrote: preview.wrote,
      preserved: [],
      configDir,
    })
    await emit(report, args.format)
    return preview.exitCode
  }
  const result =
    args.kind === 'validate'
      ? await validateProject({
          configPath,
          ...(args.warningsAsErrors ? { warningsAsErrors: true } : {}),
        })
      : await buildProject({
          configPath,
          ...(args.emailId ? { onlyId: args.emailId } : {}),
          ...(args.locale ? { locale: args.locale } : {}),
          ...(args.warningsAsErrors ? { warningsAsErrors: true } : {}),
        })
  await emit(projectReport(args.kind, result, configDir), args.format)
  return result.exitCode
}

async function startDevCommand(
  configPath: string,
  configDir: string,
  args: Extract<ParsedArgs, { kind: 'dev' }>,
): Promise<number> {
  try {
    const require = createRequire(configPath)
    const resolved = require.resolve('@vtex-email/preview')
    const imported = (await import(pathToFileURL(resolved).href)) as {
      startDev?: (input: { configPath: string; warningsAsErrors?: boolean }) => Promise<number>
    }
    if (!imported.startDev) throw new Error('The preview package does not export startDev.')
    return await imported.startDev({
      configPath,
      ...(args.warningsAsErrors ? { warningsAsErrors: true } : {}),
    })
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    const missing = code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND'
    const message = missing
      ? 'The preview package is not installed for this project.'
      : error instanceof Error
        ? error.message
        : 'Failed to start the preview.'
    const report = buildReport({
      command: 'usage',
      ok: false,
      exitCode: exitUsage,
      diagnostics: [{ code: 'CFG001', severity: 'error', message }],
      manifest: null,
      wrote: [],
      preserved: [],
      configDir,
    })
    await emit(report, args.format)
    return exitUsage
  }
}

function projectReport(command: 'build' | 'validate', result: ProjectResult, configDir: string): CliReport {
  return buildReport({
    command,
    ok: result.ok,
    exitCode: result.exitCode,
    diagnostics: result.diagnostics,
    manifest: result.manifest,
    wrote: result.wrote,
    preserved: result.preserved,
    configDir,
  })
}

async function emit(report: CliReport, format: 'text' | 'json'): Promise<void> {
  if (format === 'json') {
    await write(process.stdout, reportJson(report))
    await write(process.stderr, reportText(report))
    return
  }
  await write(report.ok ? process.stdout : process.stderr, reportText(report))
}

function write(stream: NodeJS.WriteStream, text: string): Promise<void> {
  if (text.length === 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    stream.write(text, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

function packageVersion(): string {
  const file = fileURLToPath(new URL('../package.json', import.meta.url))
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: string }
  return parsed.version ?? '0.0.0'
}
