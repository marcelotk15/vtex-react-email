import { describe, expect, it } from 'vitest'

import { executeProof } from './run-proof'

describe('P0 proof', () => {
  it('compiles the order and evaluates both fixtures on the same artifact', async () => {
    await expect(executeProof()).resolves.toBeUndefined()
  }, 30_000)
})
