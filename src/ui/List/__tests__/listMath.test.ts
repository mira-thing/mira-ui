import { describe, expect, it } from 'vitest'
import { buildRows, clampIndex, ensureVisible, listKeys, windowRange } from '../listMath'

describe('clampIndex', () => {
  it.each([
    [-3, 5, 0],
    [0, 5, 0],
    [3, 5, 3],
    [4, 5, 4],
    [9, 5, 4],
    [0, 1, 0],
    [0, 0, -1],
    [2, 0, -1],
  ])('clamps %i into a list of %i as %i', (index, count, expected) => {
    expect(clampIndex(index, count)).toBe(expected)
  })
})

describe('buildRows and listKeys', () => {
  const keyOf = (n: number) => `k${n}`
  const sections = [
    { key: 'a', title: 'First', items: [1, 2] },
    { key: 'gone', title: 'Empty', items: [] },
    { key: 'b', items: [3] },
    { key: 'c', title: 'Third', items: [4] },
  ]

  it('puts a header before each titled section that has items', () => {
    expect(buildRows(sections, keyOf)).toEqual([
      { kind: 'header', key: 'a', title: 'First' },
      { kind: 'item', key: 'k1', item: 1 },
      { kind: 'item', key: 'k2', item: 2 },
      { kind: 'item', key: 'k3', item: 3 },
      { kind: 'header', key: 'c', title: 'Third' },
      { kind: 'item', key: 'k4', item: 4 },
    ])
  })

  it('lists only the item keys, in row order', () => {
    expect(listKeys(sections, keyOf)).toEqual(['k1', 'k2', 'k3', 'k4'])
  })

  it('has no rows for no items', () => {
    expect(buildRows([{ key: 'a', title: 'A', items: [] }], keyOf)).toEqual([])
  })
})

describe('windowRange', () => {
  it('covers the viewport plus the overscan either side', () => {
    expect(windowRange(500, 200, 50, 100, 2)).toEqual({ start: 8, end: 16 })
  })

  it('clamps to the list at both ends', () => {
    expect(windowRange(0, 200, 50, 100, 3)).toEqual({ start: 0, end: 7 })
    expect(windowRange(4800, 200, 50, 100, 3)).toEqual({ start: 93, end: 100 })
    expect(windowRange(0, 200, 50, 3, 3)).toEqual({ start: 0, end: 3 })
  })

  it('includes a partly visible row at either edge', () => {
    expect(windowRange(25, 100, 50, 100, 0)).toEqual({ start: 0, end: 3 })
  })

  it('renders at least the first row before the viewport is measured', () => {
    expect(windowRange(0, 0, 50, 10, 0)).toEqual({ start: 0, end: 1 })
  })

  it('is empty for an empty list or a zero row height', () => {
    expect(windowRange(0, 200, 50, 0, 3)).toEqual({ start: 0, end: 0 })
    expect(windowRange(0, 200, 0, 10, 3)).toEqual({ start: 0, end: 0 })
  })

  it('ignores an overscrolled negative scrollTop', () => {
    expect(windowRange(-40, 100, 50, 10, 0)).toEqual({ start: 0, end: 2 })
  })
})

describe('ensureVisible', () => {
  it('leaves the scroll alone when the row is already in view', () => {
    expect(ensureVisible(100, 200, 150, 50)).toBe(100)
    expect(ensureVisible(100, 200, 100, 50)).toBe(100)
    expect(ensureVisible(100, 200, 250, 50)).toBe(100)
  })

  it('scrolls up just enough to show a row above the viewport', () => {
    expect(ensureVisible(300, 200, 200, 50)).toBe(200)
  })

  it('scrolls down just enough to show a row below the viewport', () => {
    expect(ensureVisible(0, 200, 300, 50)).toBe(150)
  })

  it('keeps the margin of context around the row', () => {
    expect(ensureVisible(0, 200, 150, 50, 50)).toBe(50)
    expect(ensureVisible(200, 200, 200, 50, 50)).toBe(150)
  })

  it('never scrolls above the top', () => {
    expect(ensureVisible(100, 200, 0, 50, 50)).toBe(0)
  })

  it('shrinks the margin when the viewport cannot fit it on both sides', () => {
    expect(ensureVisible(0, 100, 200, 50, 50)).toBe(175)
    expect(ensureVisible(0, 40, 200, 50, 50)).toBe(210)
  })
})
