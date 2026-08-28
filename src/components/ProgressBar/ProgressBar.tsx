import { memo, useCallback, useEffect, useReducer, useRef } from 'react'
import { formatTime } from '@/utils/time'
import { useNarration } from '@/hooks/useDJNarration'
import { getUiScale, useUiScale } from '@/uiScale'
import type { ObserverStatusActive } from '@/api/types'
import styles from './ProgressBar.module.scss'
import {
  INITIAL_SCRUB_STATE,
  PENDING_TIMEOUT_MS,
  transition,
  type ScrubEvent,
  type ScrubState,
} from './scrubMachine'

interface Props {
  status: ObserverStatusActive
  onSeek?: (positionMs: number) => void
}

const HANDLE_RADIUS = 7

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function reducer(state: ScrubState, event: ScrubEvent): ScrubState {
  return transition(state, event).next
}

function ProgressBarImpl({ status, onSeek }: Props) {
  // the position belongs to the next song, not the speech, so reuse the disabled treatment
  const { narrating } = useNarration()
  const seekDisabled = !!status.disallow_seek || narrating
  // the bar width below is measured once per effect run, so it has to re-measure when
  // the display size changes; the status deps alone would leave it stale while paused
  const uiScale = useUiScale()
  const fillRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const leftLabelRef = useRef<HTMLSpanElement | null>(null)
  const rightLabelRef = useRef<HTMLSpanElement | null>(null)

  const [scrubState, dispatch] = useReducer(reducer, INITIAL_SCRUB_STATE)
  // mirror ref so two events in one tick see latest state before re-render
  const stateRef = useRef<ScrubState>(INITIAL_SCRUB_STATE)
  stateRef.current = scrubState

  const send = useCallback(
    (event: ScrubEvent) => {
      const { next, effect } = transition(stateRef.current, event)
      stateRef.current = next
      dispatch(event)
      if (effect?.kind === 'seek') onSeek?.(effect.positionMs)
    },
    [onSeek],
  )

  useEffect(() => {
    const right = rightLabelRef.current
    if (!right) return
    // no times while the DJ talks: the duration belongs to the next song
    right.textContent = narrating ? '' : formatTime(status.duration)
  }, [status.duration, narrating])

  useEffect(() => {
    send({
      type: 'status_update',
      position: status.position,
      duration: status.duration,
      receivedAt: status.received_at,
    })
  }, [status.position, status.duration, status.received_at, send])

  const pendingAt = scrubState.kind === 'pending' ? scrubState.at : null
  useEffect(() => {
    if (pendingAt == null) return
    const t = window.setTimeout(() => send({ type: 'pending_timeout' }), PENDING_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [pendingAt, send])

  useEffect(() => {
    const fill = fillRef.current
    const handle = handleRef.current
    const left = leftLabelRef.current
    const bar = barRef.current
    if (!fill || !handle || !left || !bar) return

    // layout-space width
    const barWidth = bar.clientWidth

    // inert while the DJ talks: empty bar, no times, no rAF tracking
    if (narrating) {
      fill.style.transform = 'scaleX(0)'
      left.textContent = ''
      return
    }

    const playing = status.is_playing && !status.is_paused

    let raf = 0
    let lastSec = -1

    const tick = () => {
      const elapsed = playing ? Math.max(0, Date.now() - status.received_at) : 0
      const pos = Math.min(status.duration, status.position + elapsed)
      // priority: drag > pending > live
      const overrideRatio =
        scrubState.kind === 'gesture'
          ? scrubState.lastRatio
          : scrubState.kind === 'pending'
            ? scrubState.ratio
            : null
      const visiblePos = overrideRatio != null ? Math.round(overrideRatio * status.duration) : pos
      const f =
        overrideRatio != null
          ? overrideRatio
          : status.duration > 0
            ? clamp01(pos / status.duration)
            : 0

      fill.style.transform = `scaleX(${f})`
      const cx = f * barWidth - HANDLE_RADIUS
      const scale = scrubState.kind === 'gesture' ? 1.18 : 1
      handle.style.transform = `translate(${cx}px, -50%) scale(${scale})`

      const sec = Math.floor(visiblePos / 1000)
      if (sec !== lastSec) {
        lastSec = sec
        left.textContent = formatTime(visiblePos)
      }

      if (!playing && scrubState.kind === 'idle') return

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [
    status.position,
    status.received_at,
    status.duration,
    status.is_playing,
    status.is_paused,
    scrubState,
    uiScale,
    narrating,
  ])

  const computeRatio = useCallback((clientX: number): number => {
    const el = barRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return 0
    // pointer coords are device px, rects are layout px under zoom
    return clamp01((clientX / getUiScale() - rect.left) / rect.width)
  }, [])

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (seekDisabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    send({ type: 'pointerdown', ratio: computeRatio(e.clientX) })
  }

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (seekDisabled) return
    if (stateRef.current.kind !== 'gesture') return
    send({ type: 'pointermove', ratio: computeRatio(e.clientX) })
  }

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (seekDisabled) return
    if (stateRef.current.kind !== 'gesture') return
    e.currentTarget.releasePointerCapture(e.pointerId)

    const playing = status.is_playing && !status.is_paused
    const fromMs = playing
      ? Math.min(status.duration, status.position + Math.max(0, Date.now() - status.received_at))
      : status.position

    send({
      type: 'pointerup',
      now: Date.now(),
      duration: status.duration,
      positionAtClick: fromMs,
    })
  }

  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (seekDisabled) return
    if (stateRef.current.kind !== 'gesture') return
    if (import.meta.env.DEV) {
      console.warn('[ProgressBar] pointercancel during scrub, browser interrupted the drag', {
        pointerType: e.pointerType,
        state: stateRef.current,
      })
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // throws if no capture
    }
    send({ type: 'pointercancel' })
  }

  return (
    <div className={styles.row}>
      <span className={`${styles.time} ${styles.timeLeft}`} ref={leftLabelRef}>
        0:00
      </span>
      <div
        className={`${styles.hit} ${seekDisabled ? styles.hitDisabled : ''} ${narrating ? styles.inert : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={status.duration}
        aria-disabled={seekDisabled}
      >
        <div className={styles.bar} ref={barRef}>
          <div className={styles.barClip}>
            <div className={styles.fill} ref={fillRef} />
          </div>
          <div className={styles.handle} ref={handleRef} />
        </div>
      </div>
      <span className={`${styles.time} ${styles.timeRight}`} ref={rightLabelRef}>
        0:00
      </span>
    </div>
  )
}

export const ProgressBar = memo(ProgressBarImpl)
