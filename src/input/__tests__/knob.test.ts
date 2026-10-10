import { describe, expect, it } from 'vitest'
import { createStepFilter, knobDir } from '../knob'

describe('knobDir', () => {
  it('reads a negative deltaX as clockwise', () => {
    expect(knobDir({ deltaX: -60 })).toBe(1)
    expect(knobDir({ deltaX: -1 })).toBe(1)
  })

  it('reads a positive deltaX as counter-clockwise', () => {
    expect(knobDir({ deltaX: 60 })).toBe(-1)
    expect(knobDir({ deltaX: 1 })).toBe(-1)
  })

  it('ignores a wheel event with no horizontal movement', () => {
    expect(knobDir({ deltaX: 0 })).toBe(0)
  })
})

describe('createStepFilter', () => {
  function filterAt() {
    let t = 1_000_000
    const accept = createStepFilter({ now: () => t })
    return {
      accept,
      at: (ms: number) => {
        t = 1_000_000 + ms
      },
    }
  }

  it('drops steps closer together than the minimum interval', () => {
    const { accept, at } = filterAt()
    expect(accept(1)).toBe(true)
    at(54)
    expect(accept(1)).toBe(false)
    at(55)
    expect(accept(1)).toBe(true)
  })

  it('measures the interval from the last accepted step, not the last dropped one', () => {
    const { accept, at } = filterAt()
    expect(accept(1)).toBe(true)
    at(40)
    expect(accept(1)).toBe(false)
    at(60)
    expect(accept(1)).toBe(true)
  })

  it('treats a quick direction change as bounce', () => {
    const { accept, at } = filterAt()
    expect(accept(1)).toBe(true)
    at(100)
    expect(accept(-1)).toBe(false)
    at(139)
    expect(accept(-1)).toBe(false)
    at(140)
    expect(accept(-1)).toBe(true)
  })

  it('keeps the direction of the last accepted step when a reversal is dropped', () => {
    const { accept, at } = filterAt()
    expect(accept(1)).toBe(true)
    at(100)
    expect(accept(-1)).toBe(false)
    at(160)
    expect(accept(1)).toBe(true)
  })

  it('accepts the first step in either direction', () => {
    expect(createStepFilter({ now: () => 1_000_000 })(-1)).toBe(true)
  })

  it('takes custom timings', () => {
    let t = 1_000_000
    const accept = createStepFilter({ minMs: 10, reversalMs: 20, now: () => t })
    expect(accept(1)).toBe(true)
    t += 10
    expect(accept(1)).toBe(true)
    t += 15
    expect(accept(-1)).toBe(false)
    t += 5
    expect(accept(-1)).toBe(true)
  })
})
