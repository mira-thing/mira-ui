import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ObserverStatusActive } from '@/api/types'
import { loadArtwork } from './useColorExtract'
import type { TrackTransition } from './usePlayerControls'

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
  const cancelMotion = useRef<(() => void) | null>(null)
  const settling = useRef(Promise.resolve())
  const reduced = useRef<MediaQueryList | null>(null)
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

  const release = useCallback(() => {
    cancelMotion.current?.()
    const distance = dragX.current
    dragX.current = 0
    const elements = motionNodes()
    const reset = () =>
      elements.forEach((el) => {
        el.style.transform = 'translateX(0px)'
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
          [{ transform: `translateX(${distance}px)` }, { transform: 'translateX(0px)' }],
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
  }, [motionNodes])

  useEffect(() => {
    if (!request) return
    cancelMotion.current?.()
    dragX.current = request.direction * 7
    release()
  }, [request, release])

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

  useEffect(() => () => cancelMotion.current?.(), [])

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
  }
}
