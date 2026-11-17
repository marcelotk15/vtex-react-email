import { describe, expect, it } from 'vitest'

import { singleDocumentIssue } from './document'

const oneDocument = '<!doctype html><html><head></head><body></body></html>'

describe('single document in the string', () => {
  it('accepts one html, one head, and one body without a parser', () => {
    expect(singleDocumentIssue(oneDocument)).toBeNull()
  })

  it('accepts a document without a doctype and rejects two doctypes', () => {
    expect(singleDocumentIssue('<html><head></head><body></body></html>')).toBeNull()
    expect(singleDocumentIssue(`<!doctype html>${oneDocument}`)).toContain('"doctype":2')
  })

  it('rejects a second html in the resolved string', () => {
    const issue = singleDocumentIssue(`${oneDocument}${oneDocument}`)
    expect(issue).toContain('"html":2')
  })
})
