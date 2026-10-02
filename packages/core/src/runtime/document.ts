export function singleDocumentIssue(html: string): string | null {
  const counts = {
    doctype: countNeedle(html, '<!doctype'),
    html: countTag(html, 'html'),
    head: countTag(html, 'head'),
    body: countTag(html, 'body'),
  }
  if (counts.doctype === 1 && counts.html === 1 && counts.head === 1 && counts.body === 1) return null
  return `Resolved document has structure ${JSON.stringify(counts)}.`
}

function countNeedle(html: string, needle: string): number {
  const source = html.toLowerCase()
  const target = needle.toLowerCase()
  let count = 0
  let index = 0
  while (index < source.length) {
    const found = source.indexOf(target, index)
    if (found === -1) break
    count += 1
    index = found + target.length
  }
  return count
}

function countTag(html: string, tag: string): number {
  const source = html.toLowerCase()
  const target = `<${tag.toLowerCase()}`
  let count = 0
  let index = 0
  while (index < source.length) {
    const found = source.indexOf(target, index)
    if (found === -1) break
    const next = source[found + target.length]
    if (next === '>' || next === ' ' || next === '/' || next === '\n' || next === '\r' || next === '\t') count += 1
    index = found + target.length
  }
  return count
}
