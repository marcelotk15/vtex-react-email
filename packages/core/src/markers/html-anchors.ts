import { Tokenizer, TokenizerMode, type TokenHandler } from 'parse5'

/**
 * Anchor locator over the rendered HTML.
 *
 * Only the tokenizer of parse5 is used. Tree construction is intentionally skipped: the HTML tree builder applies
 * table rules (foster parenting, implied `tbody`, implicit end tags), which move or implicitly close block hosts
 * placed between table rows (`<tbody><vtx-anchor><tr>…</tr></vtx-anchor></tbody>`). Markers need the offsets of
 * the tags exactly as React wrote them, so elements are paired by name on an explicit stack instead.
 */

export interface SourceSpan {
  startOffset: number
  endOffset: number
}

export interface ElementLocation extends SourceSpan {
  startTag?: SourceSpan
  endTag?: SourceSpan
  attrs?: Record<string, SourceSpan>
}

export interface ElementNode {
  tagName: string
  attrs: Array<{ name: string; value: string }>
  sourceCodeLocation: ElementLocation
  childNodes: ElementNode[]
}

export interface DocumentNode {
  childNodes: ElementNode[]
}

export type TreeNode = ElementNode | DocumentNode

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/** Start tags that close an open `p` in every HTML parser ("close a p element"). */
const CLOSES_P = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'center',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'listing',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'pre',
  'search',
  'section',
  'summary',
  'table',
  'ul',
  'xmp',
])

/** Elements that bound the button scope used by the `p` rule. */
const P_SCOPE_BOUNDARY = new Set(['applet', 'button', 'caption', 'html', 'marquee', 'object', 'table', 'td', 'th'])

const RAWTEXT_ELEMENTS = new Set(['style', 'xmp', 'iframe', 'noembed', 'noframes'])
const RCDATA_ELEMENTS = new Set(['title', 'textarea'])

function span(location: { startOffset: number; endOffset: number }): SourceSpan {
  return { startOffset: location.startOffset, endOffset: location.endOffset }
}

export function parseHtml(html: string): DocumentNode {
  const document: DocumentNode = { childNodes: [] }
  const stack: ElementNode[] = []
  const noop = () => {}

  const handler: TokenHandler = {
    onComment: noop,
    onDoctype: noop,
    onCharacter: noop,
    onNullCharacter: noop,
    onWhitespaceCharacter: noop,
    onEof: noop,
    onStartTag(token) {
      const location = token.location
      if (!location) return
      const attrs: Record<string, SourceSpan> = {}
      for (const [name, value] of Object.entries(location.attrs ?? {})) attrs[name] = span(value)
      const element: ElementNode = {
        tagName: token.tagName,
        attrs: token.attrs.map((attr) => ({ name: attr.name, value: attr.value })),
        sourceCodeLocation: { ...span(location), startTag: span(location), attrs },
        childNodes: [],
      }
      if (CLOSES_P.has(token.tagName)) closeParagraph(stack)
      const parent = stack.at(-1) ?? document
      parent.childNodes.push(element)
      if (VOID_ELEMENTS.has(token.tagName) || token.selfClosing) return
      stack.push(element)
      if (RAWTEXT_ELEMENTS.has(token.tagName)) tokenizer.state = TokenizerMode.RAWTEXT
      else if (RCDATA_ELEMENTS.has(token.tagName)) tokenizer.state = TokenizerMode.RCDATA
      else if (token.tagName === 'script') tokenizer.state = TokenizerMode.SCRIPT_DATA
    },
    onEndTag(token) {
      const location = token.location
      if (!location) return
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const element = stack[index]
        if (element?.tagName !== token.tagName) continue
        element.sourceCodeLocation.endTag = span(location)
        element.sourceCodeLocation.endOffset = location.endOffset
        // Elements opened after the match stay without an explicit end tag.
        stack.length = index
        return
      }
    },
  }

  const tokenizer = new Tokenizer({ sourceCodeLocationInfo: true }, handler)
  tokenizer.write(html, true)
  return document
}

/** A browser implicitly ends an open `p` (in button scope) here; it keeps no explicit end tag. */
function closeParagraph(stack: ElementNode[]): void {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const tagName = stack[index]?.tagName ?? ''
    if (tagName === 'p') {
      stack.length = index
      return
    }
    if (P_SCOPE_BOUNDARY.has(tagName)) return
  }
}

export function walkElements(node: TreeNode, visit: (element: ElementNode) => void): void {
  if ('tagName' in node) visit(node)
  for (const child of node.childNodes) walkElements(child, visit)
}
