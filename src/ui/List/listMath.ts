export interface ListSection<T> {
  key: string
  title?: string
  items: readonly T[]
}

export type ListRowModel<T, K extends string = string> =
  { kind: 'header'; key: string; title: string } | { kind: 'item'; key: K; item: T }

/** `index` held inside `[0, count)`; -1 for an empty list. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return -1
  return Math.min(Math.max(index, 0), count - 1)
}

/** Flattens sections into fixed-height rows. An empty section gets no header. */
export function buildRows<T, K extends string>(
  sections: readonly ListSection<T>[],
  keyOf: (item: T) => K,
): ListRowModel<T, K>[] {
  const rows: ListRowModel<T, K>[] = []
  for (const section of sections) {
    if (section.items.length === 0) continue
    if (section.title) rows.push({ kind: 'header', key: section.key, title: section.title })
    for (const item of section.items) rows.push({ kind: 'item', key: keyOf(item), item })
  }
  return rows
}

/** The focusable keys of `sections` in row order, for `useKnobNav`: headers are not among them. */
export function listKeys<T, K extends string>(
  sections: readonly ListSection<T>[],
  keyOf: (item: T) => K,
): K[] {
  return sections.flatMap((s) => s.items.map(keyOf))
}

/**
 * The rows to render, `[start, end)`: those inside the viewport plus `overscan` either side.
 * All arguments are in the scroller's own layout px.
 */
export function windowRange(
  scrollTop: number,
  viewportH: number,
  rowH: number,
  count: number,
  overscan: number,
): { start: number; end: number } {
  if (count <= 0 || rowH <= 0) return { start: 0, end: 0 }
  const first = Math.floor(Math.max(scrollTop, 0) / rowH)
  const last = Math.ceil((Math.max(scrollTop, 0) + Math.max(viewportH, 0)) / rowH)
  return {
    start: Math.min(Math.max(first - overscan, 0), count),
    end: Math.min(Math.max(last + overscan, first + 1), count),
  }
}

/**
 * The `scrollTop` that brings a row fully into view with `margin` px of context around it,
 * moving as little as possible. Unchanged when the row is already in view.
 */
export function ensureVisible(
  scrollTop: number,
  viewportH: number,
  rowTop: number,
  rowH: number,
  margin = 0,
): number {
  const m = Math.max(Math.min(margin, (viewportH - rowH) / 2), 0)
  if (rowTop - m < scrollTop) return Math.max(rowTop - m, 0)
  if (rowTop + rowH + m > scrollTop + viewportH) return Math.max(rowTop + rowH + m - viewportH, 0)
  return scrollTop
}
