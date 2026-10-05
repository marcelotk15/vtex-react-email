import type { Failure } from '../diagnostics'
import type { ArgKind, EmissionCapability, EmissionProfile } from '../profile'
import type { ScopeNode } from '../scope/structure'
import type { ResolvedPath, SiteArgument, SiteRecord } from './sites'
import type { Marker } from './tokens'

import { errorDiagnostic, type Diagnostic } from '../diagnostics'
import { emitBlockClose, emitBlockOpen, emitHelperCall, emitInterpolation } from '../hbs/source'
import { findCapability } from '../profile'
import { nestSites } from '../scope/structure'
import { parseHtml, walkElements } from './html-anchors'

interface Anchor {
  id: string
  start: number
  end: number
}

export type BindResult =
  | { ok: true; markers: Map<string, Marker>; used: EmissionCapability[]; structure: ScopeNode[] }
  | Failure

export function bindSites(
  html: string,
  markers: ReadonlyMap<string, Marker>,
  sites: ReadonlyMap<string, SiteRecord>,
  profile: EmissionProfile,
): BindResult {
  const capabilityIssues = checkCapabilities(sites, profile)
  if (capabilityIssues.length > 0) return { ok: false, diagnostics: capabilityIssues }

  const located = locate(html, markers)
  if (!located.ok) return located
  const scopeIssues = checkScope(sites, located.anchors, profile)
  if (scopeIssues.length > 0) return { ok: false, diagnostics: scopeIssues }

  const next = new Map<string, Marker>()
  for (const [id, marker] of markers) {
    const site = sites.get(id)
    const filled = materialize(marker, site)
    if (!filled.ok) return filled
    next.set(id, filled.marker)
  }

  return {
    ok: true,
    markers: next,
    used: usedCapabilities(sites, profile),
    structure: nestSites(sites, markers, located.anchors),
  }
}

function checkCapabilities(sites: ReadonlyMap<string, SiteRecord>, profile: EmissionProfile): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const site of sites.values()) {
    if (site.kind === 'helper') {
      const capability = findCapability(profile, site.helper ?? '', 'inline')
      if (!capability || capability.form !== 'inline') {
        diagnostics.push(errorDiagnostic('HBS002', `Helper is not enabled: ${site.helper ?? ''}`))
        continue
      }
      diagnostics.push(...checkArguments(capability, site))
      diagnostics.push(...checkLiterals(capability, site))
    }
    if (site.kind === 'block') {
      const capability = findCapability(profile, site.block ?? '', 'block')
      if (!capability || capability.form !== 'block') {
        diagnostics.push(errorDiagnostic('HBS002', `Block is not enabled: ${site.block ?? ''}`))
        continue
      }
      if (capability.context === undefined || capability.elseContext === undefined) {
        diagnostics.push(errorDiagnostic('HBS002', `Block ${site.block ?? ''} does not declare its context.`))
      }
      diagnostics.push(...checkArguments(capability, site))
      diagnostics.push(...checkHash(capability, site))
      diagnostics.push(...checkLiterals(capability, site))
    }
    if (site.path?.emitted === '@index') {
      const capability = findCapability(profile, '@index', 'path')
      if (!capability) {
        diagnostics.push(errorDiagnostic('HBS002', 'The profile does not enable the @index path.', { path: '@index' }))
      }
    }
    diagnostics.push(...checkParentCapability(site.path, profile))
    for (const arg of site.args ?? []) diagnostics.push(...checkParentCapability(arg.path, profile))
    for (const arg of Object.values(site.hash ?? {})) diagnostics.push(...checkParentCapability(arg.path, profile))
  }
  return diagnostics
}

function checkArguments(capability: EmissionCapability, site: SiteRecord): Diagnostic[] {
  const args = site.args ?? []
  if (capability.arity && (args.length < capability.arity.min || args.length > capability.arity.max)) {
    return [
      errorDiagnostic(
        'HBS002',
        `Helper ${capability.name} expected ${capability.arity.min} argument(s) and received ${args.length}.`,
      ),
    ]
  }
  if (!capability.args) return []
  const diagnostics: Diagnostic[] = []
  capability.args.forEach((expected, index) => {
    const actual = args[index]
    if (!actual) return
    if (expected === 'expression') {
      if (actual.kind !== 'path' && actual.kind !== 'literal') {
        diagnostics.push(
          errorDiagnostic('HBS002', `Helper ${capability.name} argument ${index + 1} must be a path or literal.`),
        )
      }
      return
    }
    if (actual.kind !== expected) {
      diagnostics.push(
        errorDiagnostic('HBS002', `Helper ${capability.name} argument ${index + 1} must be a ${expected}.`),
      )
    }
  })
  return diagnostics
}

function checkHashKind(expected: ArgKind, actual: SiteArgument): boolean {
  if (expected === 'expression') return actual.kind === 'path' || actual.kind === 'literal'
  return actual.kind === expected
}

function checkHash(capability: EmissionCapability, site: SiteRecord): Diagnostic[] {
  if (!capability.hash) {
    if (site.hash && Object.keys(site.hash).length > 0) {
      return [errorDiagnostic('HBS002', `Helper ${capability.name} does not accept named arguments.`)]
    }
    return []
  }
  const diagnostics: Diagnostic[] = []
  const provided = site.hash ?? {}
  for (const expected of capability.hash) {
    const actual = provided[expected.name]
    if (!actual) {
      diagnostics.push(errorDiagnostic('HBS002', `Helper ${capability.name} requires named argument ${expected.name}.`))
      continue
    }
    if (!checkHashKind(expected.kind, actual)) {
      diagnostics.push(
        errorDiagnostic(
          'HBS002',
          `Helper ${capability.name} named argument ${expected.name} must be a ${
            expected.kind === 'expression' ? 'path or literal' : expected.kind
          }.`,
        ),
      )
    }
    if (expected.name === 'by' && actual.kind === 'literal') {
      const raw = unwrapQuotedLiteral(actual.emitted)
      if (raw === null || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
        diagnostics.push(
          errorDiagnostic('HBS002', `Helper ${capability.name} named argument by must be an identifier literal.`),
        )
      }
    }
  }
  for (const name of Object.keys(provided)) {
    if (!capability.hash.some((item) => item.name === name)) {
      diagnostics.push(errorDiagnostic('HBS002', `Helper ${capability.name} does not accept named argument ${name}.`))
    }
  }
  return diagnostics
}

function checkLiterals(capability: EmissionCapability, site: SiteRecord): Diagnostic[] {
  if (!capability.literals) return []
  const diagnostics: Diagnostic[] = []
  for (const rule of capability.literals) {
    const actual = site.args?.[rule.index]
    if (!actual || actual.kind !== 'literal') continue
    const raw = unwrapQuotedLiteral(actual.emitted)
    if (raw === null || !rule.values.includes(raw)) {
      diagnostics.push(
        errorDiagnostic(
          'HBS002',
          `Helper ${capability.name} argument ${rule.index + 1} must be one of ${rule.values.join(', ')}.`,
        ),
      )
    }
  }
  return diagnostics
}

function unwrapQuotedLiteral(emitted: string): string | null {
  if (emitted.length >= 2 && emitted.startsWith('"') && emitted.endsWith('"')) {
    return emitted.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\')
  }
  return null
}

function checkParentCapability(path: ResolvedPath | undefined, profile: EmissionProfile): Diagnostic[] {
  if (!path || path.parentHops === 0) return []
  const capability = findCapability(profile, '../', 'path')
  if (!capability)
    return [errorDiagnostic('HBS002', 'The profile does not enable the ../ segment.', { path: path.emitted })]
  return []
}

function checkScope(
  sites: ReadonlyMap<string, SiteRecord>,
  anchors: ReadonlyMap<string, Anchor>,
  profile: EmissionProfile,
): Diagnostic[] {
  const regions = regionsFrom(sites, anchors, profile)
  const diagnostics: Diagnostic[] = []
  for (const [id, site] of sites) {
    const anchor = anchors.get(id)
    if (!anchor) {
      diagnostics.push(errorDiagnostic('TOK001', `Marker ${id} was not located for scope validation.`))
      continue
    }
    const depth = depthAt(anchor.start, id, regions, 'item')
    const eachDepth = depthAt(anchor.start, id, regions, 'each')
    diagnostics.push(...checkDepth(site.path, depth, eachDepth))
    for (const arg of site.args ?? []) diagnostics.push(...checkDepth(arg.path, depth, eachDepth))
    for (const arg of Object.values(site.hash ?? {})) diagnostics.push(...checkDepth(arg.path, depth, eachDepth))
  }
  return diagnostics
}

function regionsFrom(
  sites: ReadonlyMap<string, SiteRecord>,
  anchors: ReadonlyMap<string, Anchor>,
  profile: EmissionProfile,
): Array<Anchor & { pushes: boolean; each: boolean }> {
  const regions: Array<Anchor & { pushes: boolean; each: boolean }> = []
  for (const [id, site] of sites) {
    if (site.kind !== 'block' || !site.block) continue
    const anchor = anchors.get(id)
    const capability = findCapability(profile, site.block, 'block')
    if (!anchor || !capability) continue
    regions.push({
      ...anchor,
      id,
      pushes: capability.context === 'item',
      each: site.block === 'each',
    })
  }
  return regions
}

function depthAt(
  offset: number,
  selfId: string,
  regions: ReadonlyArray<Anchor & { pushes: boolean; each: boolean }>,
  mode: 'item' | 'each',
): number {
  let depth = 0
  for (const region of regions) {
    if (region.id === selfId) continue
    if (mode === 'item' && !region.pushes) continue
    if (mode === 'each' && !region.each) continue
    if (offset > region.start && offset < region.end) depth += 1
  }
  return depth
}

function checkDepth(path: ResolvedPath | undefined, depth: number, eachDepth: number): Diagnostic[] {
  if (!path) return []
  if (path.emitted === '@index') {
    if (eachDepth < 1) {
      return [errorDiagnostic('HBS001', 'Path "@index" is only available inside each.', { path: '@index' })]
    }
    return []
  }
  if (path.parentHops <= depth) return []
  return [errorDiagnostic('HBS001', `Path "${path.emitted}" goes beyond the root context.`, { path: path.emitted })]
}

function usedCapabilities(sites: ReadonlyMap<string, SiteRecord>, profile: EmissionProfile): EmissionCapability[] {
  const names = new Set<string>()
  for (const site of sites.values()) {
    if (site.kind === 'block' && site.block) names.add(site.block)
    if (site.kind === 'helper' && site.helper) names.add(site.helper)
    if (site.path?.emitted === '@index') names.add('@index')
    if (site.path && site.path.parentHops > 0) names.add('../')
    for (const arg of site.args ?? []) {
      if (arg.path?.emitted === '@index') names.add('@index')
      if (arg.path && arg.path.parentHops > 0) names.add('../')
    }
    for (const arg of Object.values(site.hash ?? {})) {
      if (arg.path?.emitted === '@index') names.add('@index')
      if (arg.path && arg.path.parentHops > 0) names.add('../')
    }
  }
  return profile.capabilities.filter((capability) => names.has(capability.name))
}

function materialize(
  marker: Marker,
  site: SiteRecord | undefined,
): { ok: true; marker: Marker } | { ok: false; diagnostics: Diagnostic[] } {
  if (marker.kind === 'else') return { ok: true, marker: { ...marker } }
  if (!site) return { ok: false, diagnostics: [errorDiagnostic('TOK001', 'A marker has no descriptor.')] }
  if (marker.kind === 'text' && site.kind === 'value' && site.path) {
    return { ok: true, marker: { ...marker, replacement: emitInterpolation(site.path.emitted) } }
  }
  if (marker.kind === 'text' && site.kind === 'helper' && site.helper) {
    return {
      ok: true,
      marker: {
        ...marker,
        replacement: emitHelperCall(
          site.helper,
          (site.args ?? []).map((arg) => arg.emitted),
        ),
      },
    }
  }
  if (marker.kind === 'text' && site.kind === 'literal') {
    const literal = site.args?.find((arg) => arg.kind === 'literal')
    if (literal) return { ok: true, marker: { ...marker, replacement: emitInterpolation(literal.emitted) } }
  }
  if (marker.kind === 'attr' && site.kind === 'attr') {
    if (site.path) {
      return { ok: true, marker: { ...marker, replacement: emitInterpolation(site.path.emitted) } }
    }
    const args = site.args ?? []
    if (args.length === 1 && args[0]?.kind === 'literal' && args[0].emitted.startsWith('"')) {
      return { ok: true, marker: { ...marker, replacement: emitInterpolation(args[0].emitted) } }
    }
    if (args.length >= 1) {
      const replacement = args
        .map((arg) => (arg.kind === 'path' ? emitInterpolation(arg.emitted) : arg.emitted))
        .join('')
      return { ok: true, marker: { ...marker, replacement } }
    }
  }
  if (marker.kind === 'open' && site.kind === 'block' && site.block && site.path) {
    const parts = [site.path.emitted, ...(site.args ?? []).map((arg) => arg.emitted)]
    for (const [name, arg] of Object.entries(site.hash ?? {})) {
      parts.push(`${name}=${arg.emitted}`)
    }
    return {
      ok: true,
      marker: {
        ...marker,
        open: emitBlockOpen(site.block, parts),
        close: emitBlockClose(site.block),
      },
    }
  }
  return { ok: false, diagnostics: [errorDiagnostic('TOK001', 'A marker descriptor does not match its kind.')] }
}

function locate(
  html: string,
  markers: ReadonlyMap<string, Marker>,
): { ok: true; anchors: Map<string, Anchor> } | { ok: false; diagnostics: Diagnostic[] } {
  const document = parseHtml(html)
  const anchors = new Map<string, Anchor>()
  const diagnostics: Diagnostic[] = []
  walkElements(document, (element) => {
    const location = element.sourceCodeLocation
    if (!location || location.startOffset < 0 || location.endOffset < 0) return
    for (const attr of element.attrs) {
      const marker = markers.get(attr.value)
      if (!marker) continue
      if (attr.name === 'data-anchor') {
        anchors.set(attr.value, { id: attr.value, start: location.startOffset, end: location.endOffset })
        continue
      }
      if (marker.kind === 'attr' && attr.name === marker.attribute) {
        anchors.set(attr.value, { id: attr.value, start: location.startOffset, end: location.endOffset })
      }
    }
  })
  for (const id of markers.keys()) {
    if (!anchors.has(id)) diagnostics.push(errorDiagnostic('TOK001', `Marker ${id} was not located.`))
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics }
  return { ok: true, anchors }
}
