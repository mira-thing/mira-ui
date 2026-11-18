export interface CarouselMetrics {
  /** the focused item's offsetLeft within the track */
  itemLeft: number
  /** where the last item ends within the track: its offsetLeft + offsetWidth */
  contentEnd: number
  viewportWidth: number
  /** the focused item's inset from the viewport's left edge, and the track's end padding */
  leadPx: number
}

/**
 * How far the track scrolls left so the focused item sits `leadPx` in, clamped so neither
 * end of the track pulls away from its edge. All in layout px.
 */
export function trackOffset({ itemLeft, contentEnd, viewportWidth, leadPx }: CarouselMetrics) {
  const max = Math.max(0, contentEnd + leadPx - viewportWidth)
  return Math.min(Math.max(itemLeft - leadPx, 0), max)
}

// a drag this long moves at least one item, however short of the next one it stops
export const SWIPE_STEP_PX = 48

export interface RestOffsetsInput {
  /** each item's offsetLeft and offsetWidth, laid out with `from` focused */
  lefts: readonly number[]
  widths: readonly number[]
  from: number
  viewportWidth: number
  leadPx: number
}

/**
 * Where the track would rest with each item focused. Items past `from` move back by the width
 * `from` gives up when it narrows, and every offset is clamped as `trackOffset` clamps it.
 */
export function restOffsets({ lefts, widths, from, viewportWidth, leadPx }: RestOffsetsInput) {
  const last = lefts.length - 1
  const narrow = widths[from === 0 ? 1 : 0] ?? widths[from]
  const contentEnd = lefts[last] + widths[last]
  return lefts.map((left, i) =>
    trackOffset({
      itemLeft: i > from ? left - (widths[from] - narrow) : left,
      contentEnd,
      viewportWidth,
      leadPx,
    }),
  )
}

/**
 * The item a drag lands on: the one whose resting offset is nearest where the track was let go,
 * keeping `from` on a tie. A drag past `SWIPE_STEP_PX` always moves at least one item.
 */
export function swipeTarget(rests: readonly number[], from: number, offset: number, dx: number) {
  let best = from
  let bestDist = Math.abs(rests[from] - offset)
  rests.forEach((rest, i) => {
    const dist = Math.abs(rest - offset)
    if (dist < bestDist) {
      best = i
      bestDist = dist
    }
  })
  if (best === from && Math.abs(dx) >= SWIPE_STEP_PX) best = from + (dx < 0 ? 1 : -1)
  return Math.min(Math.max(best, 0), rests.length - 1)
}

/** Past either end the track follows the finger at a third of its travel. */
export function rubberBand(offset: number, max: number): number {
  if (offset < 0) return offset / 3
  if (offset > max) return max + (offset - max) / 3
  return offset
}
