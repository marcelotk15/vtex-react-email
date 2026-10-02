import { describe, expect, it } from 'vitest'

import { singleDocumentIssue } from './document'

const oneDocument = '<!doctype html><html><head></head><body></body></html>'

describe('single document in the string', () => {
  it('accepts one html, one head, and one body without a parser', () => {
    expect(singleDocumentIssue(oneDocument)).toBeNull()
  })

  it('rejects a second html in the resolved string', () => {
    const issue = singleDocumentIssue(`${oneDocument}${oneDocument}`)
    expect(issue).toContain('"html":2')
  })
})
