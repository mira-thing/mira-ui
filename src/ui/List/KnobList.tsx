import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { KnobNav } from '@/input/useKnobNav'
import { useUiScale } from '@/uiScale'
import { buildRows, ensureVisible, windowRange, type ListSection } from './listMath'
import { SectionHeader } from './SectionHeader'
import styles from './KnobList.module.scss'

export interface KnobListProps<T, K extends string> {
  sections: readonly ListSection<T>[]
  keyOf: (item: T) => K
  /** rows need no click handler of their own: the list focuses then selects on tap */
  renderRow: (item: T, state: { focused: boolean; disabled: boolean }) => ReactNode
  /** built over `listKeys(sections, keyOf)` */
  nav: KnobNav<K>
  /** every row, headers included, in layout px */
  rowHeight: number
  /** rows rendered beyond each edge of the viewport */
  overscan?: number
  /** once per row count, when focus or scroll comes within `overscan` rows of the end */
  onEndReached?: () => void
  /** shown when no section has items */
  empty: ReactNode
  className?: string
}

/**
 * A sectioned, windowed list driven by `useKnobNav`. Native scroll over absolutely placed
 * fixed-height rows; headers are ordinary rows the knob skips.
 */
export function KnobList<T, K extends string>({
  sections,
  keyOf,
  renderRow,
  nav,
  rowHeight,
  overscan = 6,
  onEndReached,
  empty,
  className,
}: KnobListProps<T, K>) {
  const rows = useMemo(() => buildRows(sections, keyOf), [sections, keyOf])
  const focusRow = useMemo(
    () => rows.findIndex((r) => r.kind === 'item' && r.key === nav.focusKey),
    [rows, nav.focusKey],
  )
  const scale = useUiScale()
  const scroller = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState(() => windowRange(0, 0, rowHeight, rows.length, overscan))

  const syncRange = (el: HTMLElement) => {
    const next = windowRange(el.scrollTop, el.clientHeight, rowHeight, rows.length, overscan)
    setRange((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
  }
  const sync = useEffectEvent(syncRange)

  // scrollTop and row tops share the unzoomed layout px of #root's zoom (open question 6)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || focusRow < 0) return
    const top = focusRow * rowHeight
    el.scrollTop = ensureVisible(el.scrollTop, el.clientHeight, top, rowHeight, rowHeight)
  }, [focusRow, rowHeight, scale])

  useLayoutEffect(() => {
    if (scroller.current) sync(scroller.current)
  }, [focusRow, rowHeight, rows.length, overscan, scale])

  const endFiredAt = useRef(-1)
  const nearEnd =
    rows.length > 0 && (range.end >= rows.length || focusRow >= rows.length - 1 - overscan)
  const endReached = useEffectEvent(() => onEndReached?.())
  useEffect(() => {
    if (!nearEnd || endFiredAt.current === rows.length) return
    endFiredAt.current = rows.length
    endReached()
  }, [nearEnd, rows.length])

  if (rows.length === 0) {
    return <div className={[styles.empty, className].filter(Boolean).join(' ')}>{empty}</div>
  }

  const visible: number[] = []
  for (let i = range.start; i < Math.min(range.end, rows.length); i++) visible.push(i)
  // a touch scroll can leave focus offscreen; keep its row mounted for the scroll back
  if (focusRow >= 0 && (focusRow < range.start || focusRow >= range.end)) visible.push(focusRow)

  return (
    <div
      ref={scroller}
      className={[styles.list, className].filter(Boolean).join(' ')}
      onScroll={(e) => syncRange(e.currentTarget)}
    >
      <div className={styles.spacer} role="listbox" style={{ height: rows.length * rowHeight }}>
        {visible.map((i) => {
          const row = rows[i]
          const style = { top: i * rowHeight, height: rowHeight }
          if (row.kind === 'header') {
            return (
              <div key={`h:${row.key}`} className={styles.row} style={style} role="presentation">
                <SectionHeader>{row.title}</SectionHeader>
              </div>
            )
          }
          const { focused, disabled, ...item } = nav.itemProps(row.key)
          return (
            <div
              key={`i:${row.key}`}
              className={styles.row}
              style={style}
              role="option"
              aria-disabled={disabled || undefined}
              {...item}
            >
              {renderRow(row.item, { focused, disabled })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
