import type { BuiltEmail } from '@vtex-email/cli'

import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { classifyChange, type SessionPaths } from './change-plan'

describe('schema change plan', () => {
  it('recompiles the matching email when its schema file changes', () => {
    const root = path.resolve('project')
    const paths: SessionPaths = {
      configDir: root,
      configFile: path.join(root, 'vtex-email.config.ts'),
      profilePath: path.join(root, 'vtex-target.ts'),
      catalogFiles: [],
      emailRoots: [path.join(root, 'emails')],
      schemasDir: path.join(root, 'schemas'),
    }
    const email = {
      id: 'custom-id',
      file: path.join(root, 'emails', 'auth-code.email.tsx'),
      fixturesPattern: 'fixtures/auth-code',
      dependencies: [],
      locales: ['pt-BR'],
    } as BuiltEmail

    const plan = classifyChange({
      paths,
      emails: [email],
      files: [path.join(root, 'schemas', 'auth-code.ts')],
    })
    expect(plan).toEqual({ kind: 'partial', compile: ['custom-id'], fixtures: [] })
  })
})
