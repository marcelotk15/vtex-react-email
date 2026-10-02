export function displayDocument(html: string, blockRemoteImages: boolean): string {
  if (!blockRemoteImages) return html
  const meta = '<meta http-equiv="Content-Security-Policy" content="img-src \'none\'">'
  if (html.includes(meta)) return html
  const head = /<head\b[^>]*>/i.exec(html)
  if (!head || head.index === undefined) return `<head>${meta}</head>${html}`
  const at = head.index + head[0].length
  return `${html.slice(0, at)}${meta}${html.slice(at)}`
}
