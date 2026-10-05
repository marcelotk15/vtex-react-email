import type { BuiltEmail } from '@vtex-email/cli/project'

import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { classifyChange, type SessionPaths } from './change-plan'

describe('schema change plan', () => {
  it('revalidates the matching email when its schema file changes', () => {
    const root = path.resolve('project')
    const paths: SessionPaths = {
      configDir: root,
      configFile: path.join(root, 'vtex-email.config.ts'),
      catalogFiles: [],
      emailRoots: [path.join(root, 'src', 'emails')],
      schemasDir: path.join(root, 'src', 'schemas'),
    }
    const email = {
      id: 'custom-id',
      file: path.join(root, 'src', 'emails', 'welcome.email.tsx'),
      fixturesPattern: 'src/fixtures/welcome',
      dependencies: [],
      locales: ['pt-BR'],
    } as unknown as BuiltEmail

    const plan = classifyChange({
      paths,
      emails: [email],
      files: [path.join(root, 'src', 'schemas', 'welcome.ts')],
    })
    expect(plan).toEqual({ kind: 'partial', compile: [], fixtures: [], schemas: ['custom-id'] })
  })
})
