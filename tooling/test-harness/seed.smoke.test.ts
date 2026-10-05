import { buildProject, validateProject } from '@vtex-email/cli/project'
import { createSeedProject, removeTempDir, SEED_FREEZE_MARKER, SEED_OPS, SEED_WELCOME } from '@vtex-email/test-harness'
import { describe, expect, it } from 'vitest'

describe('test harness seed', () => {
  it('validates and builds the synthetic seed', async () => {
    const seed = await createSeedProject()
    try {
      const validated = await validateProject({ configPath: seed.configPath })
      expect(validated).toMatchObject({ ok: true })
      const built = await buildProject({ configPath: seed.configPath })
      expect(built).toMatchObject({ ok: true })
      const welcome = built.emails.find((email) => email.id === SEED_WELCOME)
      const ops = built.emails.find((email) => email.id === SEED_OPS)
      const merged = welcome?.files.find((file) => file.role === 'merged')?.content ?? ''
      expect(merged.includes(SEED_FREEZE_MARKER)).toBe(false)
      expect(ops?.manifest?.capabilities.some((item) => item.name === 'eq')).toBe(true)
    } finally {
      await removeTempDir(seed.root)
    }
  }, 120_000)
})
