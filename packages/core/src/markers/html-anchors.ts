import { parse, type DefaultTreeAdapterMap } from 'parse5'

export type ElementNode = DefaultTreeAdapterMap['element']
export type TreeNode = DefaultTreeAdapterMap['node']

export function parseHtml(html: string): TreeNode {
  return parse(html, { sourceCodeLocationInfo: true })
}

export function walkElements(node: TreeNode, visit: (element: ElementNode) => void): void {
  if ('tagName' in node && 'attrs' in node) visit(node)
  if ('childNodes' in node) {
    for (const child of node.childNodes) walkElements(child, visit)
  }
}
