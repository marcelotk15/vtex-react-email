import type { Failure } from '../diagnostics'
import type { EmissionCapability, EmissionProfile } from '../profile'
import type { ScopeNode } from '../scope/structure'
import type { ResolvedPath, SiteRecord } from './sites'
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
      const capability = findCapability(profile, site.helper ?? '')
      if (!capability || capability.form !== 'inline') {
        diagnostics.push(errorDiagnostic('HBS002', `Helper is not enabled: ${site.helper ?? ''}`))
        continue
      }
      diagnostics.push(...checkArguments(capability, site))
    }
    if (site.kind === 'block') {
      const capability = findCapability(profile, site.block ?? '')
      if (!capability || capability.form !== 'block') {
        diagnostics.push(errorDiagnostic('HBS002', `Block is not enabled: ${site.block ?? ''}`))
        continue
      }
      if (capability.context === undefined || capability.elseContext === undefined) {
        diagnostics.push(errorDiagnostic('HBS002', `Block ${site.block ?? ''} does not declare its context.`))
      }
    }
    diagnostics.push(...checkParentCapability(site.path, profile))
    for (const arg of site.args ?? []) diagnostics.push(...checkParentCapability(arg.path, profile))
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
    if (actual && actual.kind !== expected) {
      diagnostics.push(
        errorDiagnostic('HBS002', `Helper ${capability.name} argument ${index + 1} must be a ${expected}.`),
      )
    }
  })
  return diagnostics
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
    const depth = depthAt(anchor.start, id, regions)
    diagnostics.push(...checkDepth(site.path, depth))
    for (const arg of site.args ?? []) diagnostics.push(...checkDepth(arg.path, depth))
  }
  return diagnostics
}

function regionsFrom(
  sites: ReadonlyMap<string, SiteRecord>,
  anchors: ReadonlyMap<string, Anchor>,
  profile: EmissionProfile,
): Array<Anchor & { pushes: boolean }> {
  const regions: Array<Anchor & { pushes: boolean }> = []
  for (const [id, site] of sites) {
    if (site.kind !== 'block' || !site.block) continue
    const anchor = anchors.get(id)
    const capability = findCapability(profile, site.block)
    if (!anchor || !capability) continue
    regions.push({ ...anchor, id, pushes: capability.context === 'item' })
  }
  return regions
}

function depthAt(offset: number, selfId: string, regions: ReadonlyArray<Anchor & { pushes: boolean }>): number {
  let depth = 0
  for (const region of regions) {
    if (!region.pushes || region.id === selfId) continue
    if (offset > region.start && offset < region.end) depth += 1
  }
  return depth
}

function checkDepth(path: ResolvedPath | undefined, depth: number): Diagnostic[] {
  if (!path || path.parentHops <= depth) return []
  return [errorDiagnostic('HBS001', `Path "${path.emitted}" goes beyond the root context.`, { path: path.emitted })]
}

function usedCapabilities(sites: ReadonlyMap<string, SiteRecord>, profile: EmissionProfile): EmissionCapability[] {
  const names = new Set<string>()
  for (const site of sites.values()) {
    if (site.kind === 'block' && site.block) names.add(site.block)
    if (site.kind === 'helper' && site.helper) names.add(site.helper)
    if (site.path && site.path.parentHops > 0) names.add('../')
    for (const arg of site.args ?? []) {
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
    const path = site.path
    const literal = site.args?.find((arg) => arg.kind === 'literal')
    if (path) return { ok: true, marker: { ...marker, replacement: emitInterpolation(path.emitted) } }
    if (literal) return { ok: true, marker: { ...marker, replacement: emitInterpolation(literal.emitted) } }
  }
  if (marker.kind === 'open' && site.kind === 'block' && site.block && site.path) {
    return {
      ok: true,
      marker: {
        ...marker,
        open: emitBlockOpen(site.block, [site.path.emitted]),
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
