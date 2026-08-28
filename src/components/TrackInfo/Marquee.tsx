import { memo, useLayoutEffect, useRef, useState } from 'react'
import { useUiScale } from '@/uiScale'
import styles from './Marquee.module.scss'

interface Props {
  text: string
  className?: string
}

const SLIDE_PX_PER_SEC = 35
const SLIDE_PHASE_RATIO = 0.32

function MarqueeImpl({ text, className }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [animate, setAnimate] = useState(false)
  // NoLyricsView's container is a shrinkable percentage width, so the overflow distance
  // measured below changes with the display size
  const uiScale = useUiScale()

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const inner = innerRef.current
    if (!wrap || !inner) return

    wrap.style.removeProperty('--marquee-distance')
    wrap.style.removeProperty('--marquee-duration')

    const overflow = inner.offsetWidth - wrap.clientWidth
    if (overflow > 4) {
      const duration = Math.max(6, overflow / (SLIDE_PX_PER_SEC * SLIDE_PHASE_RATIO))
      wrap.style.setProperty('--marquee-distance', `-${overflow}px`)
      wrap.style.setProperty('--marquee-duration', `${duration.toFixed(1)}s`)
      setAnimate(true)
    } else {
      setAnimate(false)
    }
  }, [text, uiScale])

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${animate ? styles.animating : ''} ${className ?? ''}`}
    >
      <div className={styles.maskRight}>
        <div ref={innerRef} className={styles.inner} dir="auto">
          {text}
        </div>
      </div>
    </div>
  )
}

export const Marquee = memo(MarqueeImpl)
