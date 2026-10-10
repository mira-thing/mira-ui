/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GLASS_PAD, SURFACE_BORDER, SURFACE_INSET, SURFACE_PAD } from '../metrics'

const variables = readFileSync(resolve(process.cwd(), 'src/styles/_variables.scss'), 'utf8')

function px(name: string): number {
  const match = new RegExp(`^\\$${name}:\\s*(\\d+)px;`, 'm').exec(variables)
  if (!match) throw new Error(`$${name} is not a plain px value in _variables.scss`)
  return Number(match[1])
}

describe('theme metrics', () => {
  it('match the scss tokens', () => {
    expect(SURFACE_PAD).toBe(px('surface-pad'))
    expect(SURFACE_BORDER).toBe(px('surface-border'))
    expect(GLASS_PAD).toBe(px('glass-pad'))
  })

  it('derive the inset the same way as the scss', () => {
    expect(variables).toMatch(/^\$surface-inset: 2 \* \(\$surface-pad \+ \$surface-border\);$/m)
    expect(SURFACE_INSET).toBe(2 * (px('surface-pad') + px('surface-border')))
  })
})
