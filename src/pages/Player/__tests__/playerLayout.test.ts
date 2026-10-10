import { describe, expect, it } from 'vitest'
import { logicalSize } from '@/uiScale'
import { artSizeFor, heroArtSizeFor } from '../playerLayout'

describe('artSizeFor', () => {
  it('leaves the album art untouched at the default scale', () => {
    expect(artSizeFor(100)).toBe(200)
  })

  it('never grows the art when there is spare height', () => {
    expect(artSizeFor(85)).toBe(200)
  })

  it('shrinks the art so the left column still fits the stage row', () => {
    expect(artSizeFor(110)).toBe(159)
    expect(artSizeFor(115)).toBe(140)
  })

  // pinned against the real scss rather than re-deriving from the same constant, which
  // would tautologically pass whatever the reserved height was set to
  it('pins the shrink curve across the range', () => {
    expect([85, 90, 95, 100, 105, 110, 115].map(artSizeFor)).toEqual([
      200, 200, 200, 200, 180, 159, 140,
    ])
  })
})

describe('heroArtSizeFor', () => {
  it('uses the player cover size at the default scale', () => {
    expect(heroArtSizeFor(100)).toBe(264)
  })

  it('keeps the cover inside the padded top slab at every notch', () => {
    for (const pct of [85, 90, 95, 100, 105, 110, 115]) {
      const available = logicalSize(pct).h - 214
      expect(heroArtSizeFor(pct)).toBeLessThanOrEqual(available)
    }
  })

  it('only shrinks when the slab can no longer hold a 264px cover', () => {
    expect([85, 90, 95, 100, 105, 110, 115].map(heroArtSizeFor)).toEqual([
      264, 264, 264, 264, 244, 223, 204,
    ])
  })
})
