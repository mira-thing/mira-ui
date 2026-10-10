import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { KnobNav } from '@/input/useKnobNav'
import { useUiScale } from '@/uiScale'
import { trackOffset } from './carouselMath'
import styles from './Carousel.module.scss'

export interface CarouselProps<T, K extends string> {
  items: readonly T[]
  keyOf: (item: T) => K
  /** items need no click handler of their own: the carousel focuses then selects on tap */
  renderItem: (item: T, state: { focused: boolean; disabled: boolean }) => ReactNode
  /** built over `items.map(keyOf)` */
  nav: KnobNav<K>
  /** the focused item's inset from the left edge, in layout px; also the padding at each end */
  leadPx?: number
  className?: string
}

const DEFAULT_LEAD_PX = 24

/**
 * A horizontal row driven by `useKnobNav`. The focused item widens by class, then the track
 * moves by transform to the item's measured offset, clamped at both ends.
 */
export function Carousel<T, K extends string>({
  items,
  keyOf,
  renderItem,
  nav,
  leadPx = DEFAULT_LEAD_PX,
  className,
}: CarouselProps<T, K>) {
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const placed = useRef(false)
  const scale = useUiScale()

  // the width swap has no transition, so the offsets read here are already final
  useLayoutEffect(() => {
    const vp = viewport.current
    const tr = track.current
    const focused = tr?.children[nav.focusIndex] as HTMLElement | undefined
    const last = tr?.lastElementChild as HTMLElement | null | undefined
    if (!vp || !tr || !focused || !last) return
    const x = trackOffset({
      itemLeft: focused.offsetLeft,
      contentEnd: last.offsetLeft + last.offsetWidth,
      viewportWidth: vp.clientWidth,
      leadPx,
    })
    const transform = `translate3d(${-x}px, 0, 0)`
    if (placed.current) {
      tr.style.transform = transform
      return
    }
    placed.current = true
    tr.style.transition = 'none'
    tr.style.transform = transform
    // flushes the jump, so the first placement does not animate in from zero
    void tr.offsetWidth
    tr.style.transition = ''
  }, [nav.focusIndex, items, leadPx, scale])

  return (
    <div ref={viewport} className={[styles.carousel, className].filter(Boolean).join(' ')}>
      <div
        ref={track}
        className={styles.track}
        role="listbox"
        aria-orientation="horizontal"
        style={{ paddingLeft: leadPx, paddingRight: leadPx }}
      >
        {items.map((item) => {
          const key = keyOf(item)
          const { focused, disabled, ...props } = nav.itemProps(key)
          return (
            <div
              key={key}
              className={focused ? `${styles.item} ${styles.focused}` : styles.item}
              role="option"
              aria-disabled={disabled || undefined}
              {...props}
            >
              {renderItem(item, { focused, disabled })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
