import { memo, useRef } from 'react'
import { getUiScale } from '@/uiScale'
import styles from './NotchedSlider.module.scss'

export interface NotchedSliderProps {
  ariaLabel: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  // fires once the value settles: on pointer release, or immediately on a step button.
  // lets a caller preview a value while dragging but only apply it on release
  onCommit?: (v: number) => void
  // the gesture was aborted rather than completed, so any preview should be discarded
  onCancel?: () => void
  format: (v: number) => string
  disabled?: boolean
  defaultValue?: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function NotchedSliderImpl({
  ariaLabel,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  onCancel,
  format,
  disabled,
  defaultValue,
}: NotchedSliderProps) {
  const barRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)
  // the value prop is still the pre-drag one inside the pointerup handler
  const latest = useRef(value)

  const count = Math.round((max - min) / step) + 1
  const ratio = max > min ? (value - min) / (max - min) : 0
  const defaultRatio = defaultValue != null && max > min ? (defaultValue - min) / (max - min) : null

  const setFromX = (clientX: number) => {
    const el = barRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // pointer coords are device px, rects are layout px under zoom
    const r = clamp((clientX / getUiScale() - rect.left) / rect.width, 0, 1)
    const snapped = clamp(Math.round((min + r * (max - min)) / step) * step, min, max)
    latest.current = snapped
    if (snapped !== value) onChange(snapped)
  }

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (disabled) return
    dragging.current = true
    latest.current = value
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromX(e.clientX)
  }
  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (dragging.current) setFromX(e.clientX)
  }
  const releaseCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const wasDragging = dragging.current
    dragging.current = false
    releaseCapture(e)
    if (wasDragging) onCommit?.(latest.current)
  }

  // a cancelled gesture must not commit: same class of bug the ProgressBar scrub
  // machine guards against, where an interrupted drag used to seek to wherever it died
  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const wasDragging = dragging.current
    dragging.current = false
    releaseCapture(e)
    if (wasDragging) onCancel?.()
  }

  // nothing else clears the drag flag if pointerup never arrives, and the component
  // outlives the sheet, so a stale flag would let a bare pointermove move the slider
  const onLostPointerCapture = () => {
    dragging.current = false
  }

  const stepBy = (dir: 1 | -1) => {
    const next = clamp(value + dir * step, min, max)
    latest.current = next
    onChange(next)
    onCommit?.(next)
  }

  return (
    <div className={`${styles.row} ${disabled ? styles.disabled : ''}`}>
      <button
        type="button"
        className={styles.stepBtn}
        onClick={() => stepBy(-1)}
        disabled={disabled || value <= min}
        aria-label={`${ariaLabel} down`}
      >
        −
      </button>
      <div
        className={styles.bar}
        ref={barRef}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        <div className={styles.notches} aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={styles.notch} />
          ))}
        </div>
        <div className={styles.fill} style={{ width: `${ratio * 100}%` }} />
        {defaultRatio != null ? (
          <div
            className={styles.defaultMark}
            style={{ left: `${defaultRatio * 100}%` }}
            aria-hidden
          />
        ) : null}
        <div className={styles.handle} style={{ left: `${ratio * 100}%` }} />
      </div>
      <button
        type="button"
        className={styles.stepBtn}
        onClick={() => stepBy(1)}
        disabled={disabled || value >= max}
        aria-label={`${ariaLabel} up`}
      >
        +
      </button>
    </div>
  )
}

export const NotchedSlider = memo(NotchedSliderImpl)
