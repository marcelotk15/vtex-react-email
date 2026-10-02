import { errorDiagnostic, type Diagnostic, type Failure } from '../diagnostics'
import { parseHtml, walkElements, type ElementNode } from './html-anchors'
import {
  opaqueTokenIssue,
  scanTokens,
  type AttrMarker,
  type ElseMarker,
  type Marker,
  type OpenMarker,
  type TextMarker,
} from './tokens'

interface Edit {
  start: number
  end: number
  text: string
  rank: number
  expected: string
}

export type RestoreResult = { ok: true; html: string } | Failure

export function restoreHandlebars(html: string, markers: ReadonlyMap<string, Marker>): RestoreResult {
  const source = html.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  if (source.includes('{{')) {
    return fail('HBS001', 'Rendered HTML already contains Handlebars delimiters.')
  }

  const scanned = scanTokens(source, markers)
  if (!scanned.ok) return fail('TOK001', scanned.message)

  const document = parseHtml(source)
  const located = new Map<string, ElementNode>()
  const attrLocated = new Map<string, Array<{ element: ElementNode; attribute: string }>>()
  walkElements(document, (element) => {
    for (const attr of element.attrs) {
      if (!markers.has(attr.value)) continue
      if (attr.name === 'data-anchor') located.set(attr.value, element)
      else {
        const sites = attrLocated.get(attr.value) ?? []
        sites.push({ element, attribute: attr.name })
        attrLocated.set(attr.value, sites)
      }
    }
  })

  const edits: Edit[] = []
  for (const [id, marker] of markers) {
    const built = editsFor(source, id, marker, markers, located, attrLocated)
    if (!built.ok) return built
    edits.push(...built.edits)
  }

  const overlap = findOverlap(edits)
  if (overlap) return fail('TOK001', overlap)

  const ordered = [...edits].sort((left, right) => right.start - left.start || left.rank - right.rank)
  let output = source
  for (const edit of ordered) {
    if (output.slice(edit.start, edit.end) !== edit.expected) {
      return fail('TOK001', 'Marker offset does not match the original string.')
    }
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end)
  }

  const leftover = opaqueTokenIssue(output)
  if (leftover || output.includes('data-anchor')) {
    return fail('TOK001', leftover ?? 'An internal marker remained after restoration.')
  }

  return { ok: true, html: output }
}

function editsFor(
  source: string,
  id: string,
  marker: Marker,
  markers: ReadonlyMap<string, Marker>,
  located: ReadonlyMap<string, ElementNode>,
  attrLocated: ReadonlyMap<string, ReadonlyArray<{ element: ElementNode; attribute: string }>>,
): { ok: true; edits: Edit[] } | { ok: false; diagnostics: Diagnostic[] } {
  if (marker.kind === 'text') return textEdits(source, id, marker, located)
  if (marker.kind === 'attr') return attrEdits(source, id, marker, attrLocated)
  if (marker.kind === 'open') return openEdits(source, id, marker, markers, located)
  return elseEdits(source, id, marker, markers, located)
}

function textEdits(
  source: string,
  id: string,
  marker: TextMarker,
  located: ReadonlyMap<string, ElementNode>,
): { ok: true; edits: Edit[] } | { ok: false; diagnostics: Diagnostic[] } {
  const closed = explicitElement(source, id, located.get(id))
  if (!closed.ok) return closed
  return {
    ok: true,
    edits: [
      {
        start: closed.location.startOffset,
        end: closed.location.endOffset,
        text: marker.replacement,
        expected: closed.text,
        rank: 0,
      },
    ],
  }
}

function attrEdits(
  source: string,
  id: string,
  marker: AttrMarker,
  attrLocated: ReadonlyMap<string, ReadonlyArray<{ element: ElementNode; attribute: string }>>,
): { ok: true; edits: Edit[] } | { ok: false; diagnostics: Diagnostic[] } {
  const sites = attrLocated.get(id) ?? []
  const declared = sites.filter((site) => site.attribute === marker.attribute)
  if (declared.length !== 1) {
    return fail('TOK001', `Attribute ${marker.attribute} of marker ${id} appears ${declared.length} time(s).`)
  }
  const edits: Edit[] = []
  for (const site of sites) {
    if (site.attribute === marker.attribute) {
      const location = site.element.sourceCodeLocation?.attrs?.[site.attribute]
      if (!location) return fail('TOK001', `Attribute ${site.attribute} of marker ${id} was not located.`)
      const expected = source.slice(location.startOffset, location.endOffset)
      if (expected !== `${site.attribute}="${id}"`) {
        return fail('TOK001', `Attribute ${site.attribute} was escaped or shifted.`)
      }
      edits.push({
        start: location.startOffset,
        end: location.endOffset,
        text: `${site.attribute}="${marker.replacement}"`,
        expected,
        rank: 0,
      })
      continue
    }
    if (!isImagePreload(site.element, site.attribute)) {
      return fail('TOK001', `Marker ${id} was copied to ${site.element.tagName} ${site.attribute}.`)
    }
    const location = site.element.sourceCodeLocation
    if (!location || location.startOffset < 0 || location.endOffset < 0) {
      return fail('TOK001', `Preload for marker ${id} has no offsets.`)
    }
    const expected = source.slice(location.startOffset, location.endOffset)
    if (!expected.startsWith('<link') || !expected.endsWith('>') || !expected.includes(id)) {
      return fail('TOK001', `Preload for marker ${id} was shifted.`)
    }
    edits.push({
      start: location.startOffset,
      end: location.endOffset,
      text: '',
      expected,
      rank: 0,
    })
  }
  return { ok: true, edits }
}

function openEdits(
  source: string,
  id: string,
  marker: OpenMarker,
  markers: ReadonlyMap<string, Marker>,
  located: ReadonlyMap<string, ElementNode>,
): { ok: true; edits: Edit[] } | { ok: false; diagnostics: Diagnostic[] } {
  const closed = explicitElement(source, id, located.get(id))
  if (!closed.ok) return closed
  const { location } = closed
  const attr = location.attrs?.['data-anchor']
  if (!attr) return fail('TOK001', `Opening ${id} was not located.`)
  const attrText = source.slice(attr.startOffset, attr.endOffset)
  if (attrText !== `data-anchor="${id}"`) return fail('TOK001', `Anchor ${id} was escaped or shifted.`)

  const edits: Edit[] = [
    { start: location.startOffset, end: location.startOffset, text: marker.open, expected: '', rank: 0 },
    anchorRemoval(source, attr.startOffset, attr.endOffset, attrText),
  ]

  if (!marker.elseId) {
    edits.push({
      start: location.endOffset,
      end: location.endOffset,
      text: marker.close,
      expected: '',
      rank: 1,
    })
    return { ok: true, edits }
  }

  const alternative = markers.get(marker.elseId)
  if (!alternative || alternative.kind !== 'else' || alternative.openId !== id) {
    return fail('TOK001', `Alternative for block ${id} is not balanced.`)
  }
  return { ok: true, edits }
}

function elseEdits(
  source: string,
  id: string,
  marker: ElseMarker,
  markers: ReadonlyMap<string, Marker>,
  located: ReadonlyMap<string, ElementNode>,
): { ok: true; edits: Edit[] } | { ok: false; diagnostics: Diagnostic[] } {
  const opener = markers.get(marker.openId)
  const closed = explicitElement(source, id, located.get(id))
  if (!opener || opener.kind !== 'open' || opener.elseId !== id) {
    return fail('TOK001', `Closing for block ${id} is not balanced.`)
  }
  if (!closed.ok) return closed
  const { location } = closed
  const attr = location.attrs?.['data-anchor']
  if (!attr) return fail('TOK001', `Closing for block ${id} is not balanced.`)
  const attrText = source.slice(attr.startOffset, attr.endOffset)
  if (attrText !== `data-anchor="${id}"`) return fail('TOK001', `Alternative anchor ${id} was escaped.`)
  return {
    ok: true,
    edits: [
      { start: location.startOffset, end: location.startOffset, text: '{{else}}', expected: '', rank: 0 },
      anchorRemoval(source, attr.startOffset, attr.endOffset, attrText),
      { start: location.endOffset, end: location.endOffset, text: opener.close, expected: '', rank: 1 },
    ],
  }
}

function findOverlap(edits: readonly Edit[]): string | null {
  const ordered = [...edits].sort((left, right) => left.start - right.start || left.end - right.end)
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    if (previous && current && previous.start < current.end && current.start < previous.end) {
      return 'Marker edits overlap.'
    }
  }
  return null
}

function explicitElement(
  source: string,
  id: string,
  element: ElementNode | undefined,
):
  | { ok: true; location: NonNullable<ElementNode['sourceCodeLocation']>; text: string }
  | { ok: false; diagnostics: Diagnostic[] } {
  const location = element?.sourceCodeLocation
  if (!element || !location || location.startOffset < 0 || location.endOffset < 0) {
    return fail('TOK001', `Element for marker ${id} was not located.`)
  }
  if (!location.endTag) {
    return fail('TOK001', `Element for marker ${id} has no explicit closing tag.`)
  }
  const text = source.slice(location.startOffset, location.endOffset)
  if (!text.toLowerCase().endsWith(`</${element.tagName}>`) || !text.includes(id)) {
    return fail('TOK001', `Element for marker ${id} does not end at the closing tag.`)
  }
  return { ok: true, location, text }
}

function isImagePreload(element: ElementNode, attribute: string): boolean {
  if (element.tagName !== 'link' || attribute !== 'href') return false
  const rel = element.attrs.find((attr) => attr.name === 'rel')?.value
  const as = element.attrs.find((attr) => attr.name === 'as')?.value
  return rel === 'preload' && as === 'image'
}

function anchorRemoval(source: string, start: number, end: number, attrText: string): Edit {
  const withSpace = start > 0 && source[start - 1] === ' '
  return {
    start: withSpace ? start - 1 : start,
    end,
    text: '',
    expected: withSpace ? ` ${attrText}` : attrText,
    rank: 2,
  }
}

function fail(code: string, message: string): { ok: false; diagnostics: Diagnostic[] } {
  return { ok: false, diagnostics: [errorDiagnostic(code, message)] }
}
