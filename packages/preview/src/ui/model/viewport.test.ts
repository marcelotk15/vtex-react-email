import { describe, expect, it } from 'vitest'

import { viewportChoice, viewportChoices } from './viewport'

describe('viewport presets', () => {
  it('keeps the historical desktop and mobile widths and adds wide and fit', () => {
    expect(viewportChoices.map((item) => [item.id, item.width, item.height])).toEqual([
      ['mobile', 375, 667],
      ['desktop', 600, null],
      ['wide', 1024, null],
      ['fit', null, null],
    ])
    expect(viewportChoice('wide').width).toBe(1024)
    expect(viewportChoice('unknown').id).toBe('desktop')
  })
})
