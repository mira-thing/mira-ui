import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ObserverStatusActive } from '@/api/types'
import { loadArtwork } from './useColorExtract'
import type { TrackTransition } from './usePlayerControls'
import { getUiScale } from '@/uiScale'

const ARMED_OPACITY = 0.6

// only the cover and metadata move
export function useTrackScene(
  status: ObserverStatusActive | null,
  transitioning: boolean,
  request?: TrackTransition | null,
) {
  const [displayed, setDisplayed] = useState(status)
  const node = useRef<HTMLDivElement | null>(null)
  const current = useRef(status)
  const displayedRef = useRef(displayed)
  const dragX = useRef(0)
  const dragFrame = useRef(0)
  const armed = useRef(false)
  const cancelMotion = useRef<(() => void) | null>(null)
  const settling = useRef(Promise.resolve())
  const reduced = useRef<MediaQueryList | null>(null)
  const gestureAcknowledged = useRef(false)
  const [localPending, setLocalPending] = useState(transitioning)
  useLayoutEffect(() => {
    current.current = status
    displayedRef.current = displayed
  })
  // hold the dim
  if (transitioning && !localPending) setLocalPending(true)
  else if (localPending && !transitioning && displayed?.track_id === status?.track_id) {
    setLocalPending(false)
  }
  useEffect(() => {
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
  }, [])

  const motionNodes = useCallback(
    () =>
      Array.from(
        node.current?.querySelectorAll<HTMLElement>(
          '[data-track-active="true"] [data-track-motion]',
        ) ?? [],
      ),
    [],
  )

  const release = useCallback(
    (committed?: boolean) => {
      gestureAcknowledged.current = committed === true
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = 0
      cancelMotion.current?.()
      const distance = dragX.current
      const opacity = armed.current ? ARMED_OPACITY : 1
      dragX.current = 0
      armed.current = false
      const elements = motionNodes()
      const reset = () =>
        elements.forEach((el) => {
          el.style.transform = 'translateX(0px)'
          el.style.opacity = ''
          el.style.willChange = ''
        })
      if (!distance || reduced.current?.matches || !elements[0]?.animate) {
        reset()
        settling.current = Promise.resolve()
        return
      }
      settling.current = new Promise<void>((resolve) => {
        const animations = elements.map((el) => {
          el.style.willChange = 'transform'
          return el.animate(
            [
              { transform: `translateX(${distance}px)`, opacity },
              { transform: 'translateX(0px)', opacity: 1 },
            ],
            { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
          )
        })
        let finished = false
        const finish = () => {
          if (finished) return
          finished = true
          clearTimeout(timer)
          reset()
          animations.forEach((animation) => animation.cancel())
          cancelMotion.current = null
          resolve()
        }
        const timer = window.setTimeout(finish, 320)
        animations[0].onfinish = finish
        cancelMotion.current = finish
      })
    },
    [motionNodes],
  )

  useEffect(() => {
    if (!request) return
    if (gestureAcknowledged.current) {
      gestureAcknowledged.current = false
      return
    }
    cancelMotion.current?.()
    dragX.current = request.direction * 7
    release()
  }, [request, release])

  const drag = useCallback(
    (distance: number, willSkip = false) => {
      cancelMotion.current?.()
      if (reduced.current?.matches) return
      // a step and a dim once letting go would skip, so cancelling is easy to judge
      armed.current = willSkip
      dragX.current =
        12 * Math.tanh(distance / getUiScale() / 100) + (willSkip ? Math.sign(distance) * 6 : 0)
      if (dragFrame.current) return
      dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = 0
        motionNodes().forEach((el) => {
          el.style.willChange = 'transform'
          el.style.transform = `translateX(${dragX.current}px)`
          el.style.opacity = armed.current ? String(ARMED_OPACITY) : ''
        })
      })
    },
    [motionNodes],
  )

  const identity = status ? `${status.track_id}\n${status.track_image}` : undefined
  useEffect(() => {
    const next = current.current
    const old = displayedRef.current
    if (!next || !old) {
      setDisplayed(next)
      return
    }
    if (next.track_id === old.track_id && next.track_image === old.track_image) return
    let cancelled = false
    let deadline = 0
    void (async () => {
      await new Promise<void>((resolve) => {
        deadline = window.setTimeout(resolve, 400)
        void loadArtwork(next.track_image).then(() => {
          window.clearTimeout(deadline)
          resolve()
        })
      })
      await settling.current
      if (!cancelled) setDisplayed(current.current)
    })()
    return () => {
      cancelled = true
      window.clearTimeout(deadline)
    }
  }, [identity])

  useEffect(
    () => () => {
      cancelAnimationFrame(dragFrame.current)
      cancelMotion.current?.()
    },
    [],
  )

  return {
    status:
      displayed && status && displayed.track_id === status.track_id
        ? displayed.track_image === status.track_image
          ? status
          : { ...status, track_image: displayed.track_image }
        : displayed,
    pending:
      transitioning ||
      !!(localPending && status && displayed && status.track_id !== displayed.track_id),
    ref: node,
    drag,
    release,
  }
}
