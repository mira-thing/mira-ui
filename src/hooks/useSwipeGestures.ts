import { useEffect, useRef, useState, type RefCallback } from 'react'
import {
  classify,
  createPhantomFilter,
  INITIAL_SWIPE_STATE,
  type SwipeAction,
  type SwipeState,
  type TouchPoint,
  skipFor,
} from '@/gestures/swipeMachine'

// prevent accidental seeks
const CLICK_SUPPRESS_MS = 350

interface Params {
  onNext: () => void
  onPrev: () => void
  onToggleView: () => void
  enabled: boolean
  onDrag?: (distance: number, armed: boolean) => void
  onDragEnd?: (committed: boolean) => void
  canNext?: boolean
  canPrev?: boolean
}

// Attaches one swipe detector to the player view
export function useSwipeGestures<T extends HTMLElement>({
  onNext,
  onPrev,
  onToggleView,
  enabled,
  onDrag,
  onDragEnd,
  canNext = true,
  canPrev = true,
}: Params): RefCallback<T> {
  const [el, setElement] = useState<T | null>(null)
  // keep the latest handlers without re-attaching the touch listeners on every render
  const handlersRef = useRef({ onNext, onPrev, onToggleView, onDrag, onDragEnd, canNext, canPrev })
  useEffect(() => {
    handlersRef.current = { onNext, onPrev, onToggleView, onDrag, onDragEnd, canNext, canPrev }
  })

  useEffect(() => {
    if (!el || !enabled) return

    let state: SwipeState = INITIAL_SWIPE_STATE
    let suppressClickUntil = 0
    // once a 2nd finger appears we stop it from reaching the lyrics
    let multiTouch = false
    let horizontal = false
    // drop ghost fingers
    const liveTouches = createPhantomFilter()
    const listOf = (l: TouchList): TouchPoint[] => Array.from(l)

    const centroid = (touches: readonly TouchPoint[]): { x: number; y: number } => {
      let x = 0
      let y = 0
      for (const t of touches) {
        x += t.clientX
        y += t.clientY
      }
      const n = touches.length || 1
      return { x: x / n, y: y / n }
    }

    const fire = (action: SwipeAction | undefined): void => {
      if (!action) return
      suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS
      const h = handlersRef.current
      if (action === 'next') h.onNext()
      else if (action === 'prev') h.onPrev()
      else h.onToggleView()
    }

    const onStart = (e: TouchEvent): void => {
      const live = liveTouches(listOf(e.touches), listOf(e.changedTouches))
      if (live.length <= 1 && horizontal) {
        handlersRef.current.onDragEnd?.(false)
        horizontal = false
      }
      if (live.length <= 1) multiTouch = false
      if (live.length >= 2) multiTouch = true
      if (multiTouch && horizontal) {
        handlersRef.current.onDragEnd?.(false)
        horizontal = false
      }
      const c = centroid(live)
      state = classify(state, { type: 'start', x: c.x, y: c.y, touches: live.length }).next
      if (multiTouch) e.stopPropagation()
    }
    const onMove = (e: TouchEvent): void => {
      const live = liveTouches(listOf(e.touches), listOf(e.changedTouches))
      if (live.length >= 2) multiTouch = true
      const c = centroid(live)
      const r = classify(state, { type: 'move', x: c.x, y: c.y, touches: live.length })
      state = r.next
      if (state.kind === 'tracking' && state.maxTouches === 1 && state.mode === 'horizontal') {
        horizontal = true
        suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS
        const h = handlersRef.current
        const dx = state.lastX - state.startX
        const skip = skipFor(dx, state.lastY - state.startY)
        h.onDrag?.(dx, skip === 'next' ? h.canNext : skip === 'prev' ? h.canPrev : false)
      }
      if (multiTouch || horizontal) e.stopPropagation()
      fire(r.action)
    }
    const onEnd = (e: TouchEvent): void => {
      const live = liveTouches(listOf(e.touches), listOf(e.changedTouches))
      if (multiTouch) e.stopPropagation()
      const r = classify(state, { type: 'end', touches: live.length })
      state = r.next
      if (live.length === 0) {
        const h = handlersRef.current
        const action = e.type === 'touchcancel' ? undefined : r.action
        const allowed = action === 'next' ? h.canNext : action === 'prev' ? h.canPrev : false
        if (horizontal) {
          suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS
          e.stopPropagation()
          h.onDragEnd?.(!!action && allowed)
        }
        if (allowed) fire(action)
        horizontal = false
      }
      if (live.length === 0) multiTouch = false
    }
    const onClickCapture = (e: MouseEvent): void => {
      if (Date.now() >= suppressClickUntil) return
      e.stopPropagation()
      e.preventDefault()
      suppressClickUntil = 0
    }

    // passive touch listeners
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    el.addEventListener('click', onClickCapture, { capture: true })
    return () => {
      if (horizontal) handlersRef.current.onDragEnd?.(false)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      el.removeEventListener('click', onClickCapture, { capture: true })
    }
  }, [el, enabled])
  return setElement
}
