import { describe, expect, it } from 'vitest'

import { TOKEN_PREFIX } from './index'

describe('workspace', () => {
  it('runs the runner', () => {
    expect(TOKEN_PREFIX).toBe('vtx')
  })
})
