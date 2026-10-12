import { describe, expect, it } from 'vitest'
import {
  backgroundDepthColor,
  groundTone,
  surfaceGlowColor,
  surfaceTintColor,
  type RGB,
} from '../useColorExtract'

// fixed inputs spanning saturated, muted, grey, dark and light; the outputs are pinned so a
// refactor of the theme roles cannot move a single channel
const INPUTS: Record<string, RGB> = {
  red: [220, 40, 50],
  teal: [30, 160, 150],
  muted: [120, 110, 90],
  grey: [128, 128, 128],
  dark: [12, 18, 40],
  light: [240, 230, 250],
}

function tones(rgb: RGB) {
  return {
    tint: surfaceTintColor(rgb),
    glow: surfaceGlowColor(rgb),
    depth: backgroundDepthColor(rgb),
    base: groundTone(rgb, 'base'),
    deep: groundTone(rgb, 'deep'),
    hot: groundTone(rgb, 'hot'),
  }
}

const PINNED: Record<string, ReturnType<typeof tones>> = {
  red: {
    tint: [99, 23, 27],
    glow: [237, 29, 40],
    depth: [33, 18, 19],
    base: [92, 23, 27],
    deep: [52, 17, 19],
    hot: [163, 20, 28],
  },
  teal: {
    tint: [23, 99, 93],
    glow: [32, 233, 218],
    depth: [18, 33, 32],
    base: [23, 92, 87],
    deep: [17, 52, 49],
    hot: [20, 163, 152],
  },
  muted: {
    tint: [70, 64, 52],
    glow: [175, 147, 90],
    depth: [29, 27, 22],
    base: [66, 60, 49],
    deep: [39, 36, 30],
    hot: [110, 98, 74],
  },
  grey: {
    tint: [61, 61, 61],
    glow: [175, 90, 90],
    depth: [26, 26, 26],
    base: [57, 57, 57],
    deep: [34, 34, 34],
    hot: [92, 92, 92],
  },
  dark: {
    tint: [28, 42, 94],
    glow: [54, 87, 212],
    depth: [18, 21, 33],
    base: [18, 26, 59],
    deep: [13, 19, 39],
    hot: [18, 39, 114],
  },
  light: {
    tint: [61, 23, 99],
    glow: [133, 35, 231],
    depth: [25, 18, 33],
    base: [57, 23, 92],
    deep: [34, 17, 52],
    hot: [92, 20, 163],
  },
}

describe('theme tone functions', () => {
  it.each(Object.keys(INPUTS))('pin their outputs for %s', (name) => {
    expect(tones(INPUTS[name])).toEqual(PINNED[name])
  })
})
