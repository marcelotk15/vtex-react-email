import { describe, expect, it } from 'vitest'

import {
  checkChangesetCoverage,
  isReleasePrContext,
  packagesFromChangedFiles,
  parseChangesetMarkdown,
} from './changeset-coverage.mjs'

describe('parseChangesetMarkdown', () => {
  it('parses package bumps', () => {
    const parsed = parseChangesetMarkdown(`---
"@vtex-email/preview": patch
"@vtex-email/cli": minor
---

Improve preview shell.
`)
    expect(parsed.empty).toBe(false)
    expect(parsed.packages).toEqual({
      '@vtex-email/preview': 'patch',
      '@vtex-email/cli': 'minor',
    })
  })

  it('detects empty changesets', () => {
    expect(parseChangesetMarkdown('---\n---\n\nNo release.\n').empty).toBe(true)
  })
})

describe('packagesFromChangedFiles', () => {
  it('maps package paths and ignores examples', () => {
    const affected = packagesFromChangedFiles([
      'packages/preview/src/ui/sheet.tsx',
      'packages/cli/src/index.ts',
      'examples/basic-store/emails/auth-code.email.tsx',
      'docs/release.md',
    ])
    expect([...affected].sort()).toEqual(['@vtex-email/cli', '@vtex-email/preview'])
  })
})

describe('checkChangesetCoverage', () => {
  it('allows preview-only change with preview changeset', () => {
    const result = checkChangesetCoverage({
      changedFiles: ['packages/preview/src/ui/theme/theme.ts'],
      changesetContents: [
        `---
"@vtex-email/preview": patch
---

Theme tweak.
`,
      ],
    })
    expect(result.ok).toBe(true)
  })

  it('allows cli-only change with cli changeset', () => {
    const result = checkChangesetCoverage({
      changedFiles: ['packages/cli/src/bin.ts'],
      changesetContents: [
        `---
"@vtex-email/cli": patch
---

Bin help text.
`,
      ],
    })
    expect(result.ok).toBe(true)
  })

  it('requires dependents declaration when core changes', () => {
    const result = checkChangesetCoverage({
      changedFiles: ['packages/core/src/index.ts', 'packages/cli/src/project.ts'],
      changesetContents: [
        `---
"@vtex-email/core": minor
---

New compile helper.
`,
      ],
    })
    expect(result).toEqual({
      ok: false,
      missing: ['@vtex-email/cli'],
      reason: 'Publishable packages changed without a covering changeset: @vtex-email/cli',
    })
  })

  it('accepts empty changeset for basic-store-only work', () => {
    const result = checkChangesetCoverage({
      changedFiles: ['examples/basic-store/emails/auth-code.email.tsx'],
      changesetContents: ['---\n---\n\nExample only.\n'],
    })
    // example is not publishable — ok even without empty, but empty is fine
    expect(result.ok).toBe(true)
  })

  it('accepts empty changeset when publishable files change without release', () => {
    const result = checkChangesetCoverage({
      changedFiles: ['packages/preview/src/ui/sheet.tsx'],
      changesetContents: ['---\n---\n\nRefactor without release.\n'],
    })
    expect(result.ok).toBe(true)
  })

  it('fails when unrelated changeset does not cover touched package', () => {
    const result = checkChangesetCoverage({
      changedFiles: ['packages/preview/src/ui/sheet.tsx'],
      changesetContents: [
        `---
"@vtex-email/cli": patch
---

Wrong package.
`,
      ],
    })
    expect(result.ok).toBe(false)
  })

  it('skips Version Packages PR', () => {
    expect(
      checkChangesetCoverage({
        changedFiles: ['packages/core/package.json'],
        changesetContents: [],
        isReleasePr: true,
      }).ok,
    ).toBe(true)
  })
})

describe('isReleasePrContext', () => {
  it('detects chore(release) title and changeset branch', () => {
    expect(isReleasePrContext({ prTitle: 'chore(release): version packages' })).toBe(true)
    expect(isReleasePrContext({ headRef: 'changeset-release/master' })).toBe(true)
    expect(isReleasePrContext({ prTitle: 'feat(preview): theme' })).toBe(false)
  })
})
