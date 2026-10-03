import { describe, expect, it } from 'vitest'

import {
  checkChangesetCoverage,
  isReleasePrContext,
  isVersionPackagesDiff,
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

  it('accepts planned dependent bumps from Changesets without a direct changeset file', () => {
    const result = checkChangesetCoverage({
      changedFiles: ['packages/cli/src/bin.ts', 'packages/preview/package.json'],
      changesetContents: [
        `---
"@vtex-email/cli": patch
---

CLI fix that out-of-ranges preview.
`,
      ],
      plannedDependentBumps: ['@vtex-email/preview'],
    })
    expect(result.ok).toBe(true)
  })

  it('skips structural Version Packages PR and does not demand new changesets', () => {
    expect(
      checkChangesetCoverage({
        changedFiles: ['packages/preview/package.json', 'packages/preview/CHANGELOG.md', 'pnpm-lock.yaml'],
        changesetContents: [],
        isReleasePr: true,
      }).ok,
    ).toBe(true)
  })

  it('accepts empty changeset when publishable files change without release', () => {
    const result = checkChangesetCoverage({
      changedFiles: ['packages/preview/src/ui/sheet.tsx'],
      changesetContents: ['---\n---\n\nRefactor without release.\n'],
    })
    expect(result.ok).toBe(true)
  })
})

describe('isVersionPackagesDiff', () => {
  it('accepts version metadata only', () => {
    expect(
      isVersionPackagesDiff([
        'packages/preview/package.json',
        'packages/preview/CHANGELOG.md',
        '.changeset/fancy-fox.md',
        'pnpm-lock.yaml',
      ]),
    ).toBe(true)
  })

  it('rejects source edits', () => {
    expect(isVersionPackagesDiff(['packages/preview/package.json', 'packages/preview/src/ui/sheet.tsx'])).toBe(false)
  })
})

describe('isReleasePrContext', () => {
  it('does not accept title alone', () => {
    expect(
      isReleasePrContext({
        prTitle: 'chore(release): version packages',
        changedFiles: ['packages/preview/package.json'],
      }),
    ).toBe(false)
  })

  it('does not accept author-like title without changeset-release branch', () => {
    expect(
      isReleasePrContext({
        prTitle: 'chore(release): version packages',
        headRef: 'feature/fake-release',
        changedFiles: ['packages/preview/package.json', 'pnpm-lock.yaml'],
      }),
    ).toBe(false)
  })

  it('accepts structural Version Packages PR', () => {
    expect(
      isReleasePrContext({
        prTitle: 'anything',
        headRef: 'changeset-release/main',
        changedFiles: [
          'packages/preview/package.json',
          'packages/preview/CHANGELOG.md',
          '.changeset/old.md',
          'pnpm-lock.yaml',
        ],
      }),
    ).toBe(true)
  })

  it('rejects changeset-release branch with unrelated source changes', () => {
    expect(
      isReleasePrContext({
        headRef: 'changeset-release/main',
        changedFiles: ['packages/preview/src/ui/sheet.tsx', 'packages/preview/package.json'],
      }),
    ).toBe(false)
  })
})
