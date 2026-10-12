import { describe, expect, it } from 'vitest'
import {
  backgroundDepthColor,
  groundTone,
  surfaceGlowColor,
  surfaceTintColor,
  type RGB,
} from '@/hooks/useColorExtract'
import { deriveRoles, IDLE_ROLES } from '../seed'

const RED: RGB = [220, 40, 50]
const TEAL: RGB = [30, 160, 150]
const MUTED: RGB = [120, 110, 90]

describe('deriveRoles', () => {
  it('takes the surface roles from the accent', () => {
    const roles = deriveRoles([RED, TEAL, MUTED])
    expect(roles.tint).toEqual(surfaceTintColor(RED))
    expect(roles.glow).toEqual(surfaceGlowColor(RED))
    expect(roles.depth).toEqual(backgroundDepthColor(RED))
  })

  it('gives each orb its palette colour: deep the second, base the accent, hot the third', () => {
    expect(deriveRoles([RED, TEAL, MUTED]).ground).toEqual({
      deep: groundTone(TEAL, 'deep'),
      base: groundTone(RED, 'base'),
      hot: groundTone(MUTED, 'hot'),
    })
  })

  it('reuses the previous colour when the palette is short', () => {
    expect(deriveRoles([RED, TEAL]).ground).toEqual({
      deep: groundTone(TEAL, 'deep'),
      base: groundTone(RED, 'base'),
      hot: groundTone(TEAL, 'hot'),
    })
    expect(deriveRoles([RED]).ground).toEqual({
      deep: groundTone(RED, 'deep'),
      base: groundTone(RED, 'base'),
      hot: groundTone(RED, 'hot'),
    })
  })

  it('pins the exact values the player paints with', () => {
    expect(deriveRoles([RED, TEAL, MUTED])).toEqual({
      tint: [99, 23, 27],
      glow: [237, 29, 40],
      depth: [33, 18, 19],
      ground: { deep: [17, 52, 49], base: [92, 23, 27], hot: [110, 98, 74] },
    })
  })

  it('is the idle look for an empty palette', () => {
    expect(deriveRoles([])).toBe(IDLE_ROLES)
  })

  it('pins the idle look: black depth and tint, the screensaver green glow', () => {
    expect(IDLE_ROLES).toEqual({
      tint: [0, 0, 0],
      glow: [30, 215, 96],
      depth: [0, 0, 0],
      ground: { deep: [0, 0, 0], base: [0, 0, 0], hot: [0, 0, 0] },
    })
  })
})
