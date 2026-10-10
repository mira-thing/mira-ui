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
