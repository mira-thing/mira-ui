import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ObserverStatusActive, QueueTrack } from '@/api/types'
import { loadArtwork } from './useColorExtract'
import { isNarrationItem, isNarrationUri } from './useDJNarration'
import { queueTrackFields } from './usePrefetch'
import type { TrackTransition } from './usePlayerControls'
import { getUiScale } from '@/uiScale'

const ARMED_OPACITY = 0.6
// a track whose title or cover never resolves still shows after this
const BARE_TRACK_MS = 2000
// Spotify restarts a track on Previous rather than leaving it once it is this far in
const PREV_RESTARTS_MS = 3000
// a skip Spotify was slow to confirm still gets this long to land before the scene gives up on it
const SLOW_SKIP_MS = 2000

/** The queued track a Next lands on from `shownId`, as a status, or null when the queue can't say. */
function nextInQueue(status: ObserverStatusActive, shownId: string): ObserverStatusActive | null {
  const queue = status.next_tracks ?? []
  const at = shownId === status.track_id ? 0 : queue.findIndex((t) => t.track_id === shownId) + 1
  if (at === 0 && shownId !== status.track_id) return null
  const track: QueueTrack | undefined = queue[at]
  if (!track?.track_id || !track.name || isNarrationUri(track.uri)) return null
  return {
    ...status,
    ...queueTrackFields(track),
    track_id: track.track_id,
    track_uri: track.uri,
    // the queue doesn't carry one, and the old track's would mislead the lyrics lookup
    duration: 0,
    position: 0,
    received_at: Date.now(),
  }
}

// the daemon's QueueLimit; it keeps the oldest of prev_tracks, so a full list may lack the last track
const QUEUE_LIMIT = 10

/**
 * The track a Previous returns to from `shownId`, from what the scene showed before it. Null when
 * the scene trails playback, or Spotify will restart the track instead.
 */
function backInHistory(
  status: ObserverStatusActive,
  shownId: string,
  history: ObserverStatusActive[],
  { ahead, fromStart }: { ahead: boolean; fromStart: boolean },
): ObserverStatusActive | null {
  const before = history[history.length - 1]
  if (!before || before.track_id === shownId) return null
  if (shownId !== status.track_id && !ahead) return null
  if (shownId === status.track_id) {
    const played = status.position + (status.is_playing ? Date.now() - status.received_at : 0)
    if (!fromStart && played > PREV_RESTARTS_MS) return null
    const prevs = status.prev_tracks ?? []
    if (prevs.length === 0) return null
    if (prevs.length < QUEUE_LIMIT && prevs[prevs.length - 1].track_id !== before.track_id) {
      return null
    }
  }
  return {
    ...status,
    track_id: before.track_id,
    track_uri: before.track_uri,
    track_name: before.track_name,
    track_artist: before.track_artist,
    track_album: before.track_album,
    track_image: before.track_image,
    duration: before.duration,
    position: 0,
    received_at: Date.now(),
  }
}

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
  // a skip shows where it lands at once; Spotify takes most of a second to confirm it
  const [aheadId, setAheadId] = useState<string | null>(null)
  const aheadRef = useRef(aheadId)
  // the track playing when the scene ran ahead, which a skip that failed never leaves
  const aheadFrom = useRef<string | null>(null)
  useLayoutEffect(() => {
    current.current = status
    displayedRef.current = displayed
    aheadRef.current = aheadId
  })
  // the tracks shown before this one, newest last, so a Previous can show where it lands at once
  const history = useRef<ObserverStatusActive[]>([])
  const lastShown = useRef(displayed)
  useLayoutEffect(() => {
    const was = lastShown.current
    lastShown.current = displayed
    if (!was || !displayed || was.track_id === displayed.track_id) return
    const seen = history.current
    if (seen[seen.length - 1]?.track_id === displayed.track_id) seen.pop()
    else if (!isNarrationItem(was)) {
      seen.push(was)
      if (seen.length > QUEUE_LIMIT) seen.shift()
    }
  }, [displayed])
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

  // before paint, so the frame that takes the tap already shows the next track
  useLayoutEffect(() => {
    if (!request) return
    const live = current.current
    const shown = displayedRef.current
    const ahead =
      !live || !shown
        ? null
        : request.direction === -1
          ? nextInQueue(live, shown.track_id)
          : backInHistory(live, shown.track_id, history.current, {
              ahead: shown.track_id === aheadRef.current,
              fromStart: !!request.fromStart,
            })
    if (ahead) {
      aheadFrom.current = live?.track_id ?? null
      setAheadId(ahead.track_id)
      setDisplayed(ahead)
    }
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

  // when the shown track's successor was first announced, so partial metadata can't extend the hold
  const bareSince = useRef({ id: '', at: 0 })
  const identity = status ? `${status.track_id}\n${status.track_image}` : undefined
  const metaKnown = !!status?.track_name
  useEffect(() => {
    const next = current.current
    const old = displayedRef.current
    if (!next || !old) {
      setDisplayed(next)
      return
    }
    if (
      next.track_id === old.track_id &&
      (!next.track_image || next.track_image === old.track_image)
    )
      return
    let cancelled = false
    let deadline = 0
    let bare = 0
    void (async () => {
      // the daemon announces a track before its title and cover resolve; showing it bare blanks the scene
      const bareTrack = !next.track_image || !next.track_name
      if (next.track_id !== old.track_id && bareTrack && !isNarrationItem(next)) {
        if (bareSince.current.id !== next.track_id)
          bareSince.current = { id: next.track_id, at: Date.now() }
        const left = BARE_TRACK_MS - (Date.now() - bareSince.current.at)
        await new Promise<void>((resolve) => {
          bare = window.setTimeout(resolve, left)
        })
      } else {
        await new Promise<void>((resolve) => {
          deadline = window.setTimeout(resolve, 400)
          void loadArtwork(next.track_image).then(() => {
            window.clearTimeout(deadline)
            resolve()
          })
        })
      }
      await settling.current
      if (cancelled) return
      bareSince.current.id = ''
      setDisplayed(current.current)
    })()
    return () => {
      cancelled = true
      window.clearTimeout(deadline)
      window.clearTimeout(bare)
    }
  }, [identity, metaKnown])

  // a skip that failed, or landed elsewhere, gives the scene back to what is really playing
  useEffect(() => {
    if (transitioning || aheadId === null) return
    const live = current.current
    const giveBack = () => {
      setAheadId(null)
      const now = current.current
      if (now && now.track_id !== aheadId) setDisplayed(now)
    }
    if (!live || live.track_id === aheadId || live.track_id !== aheadFrom.current) {
      giveBack()
      return
    }
    const timer = window.setTimeout(giveBack, SLOW_SKIP_MS)
    return () => window.clearTimeout(timer)
  }, [transitioning, aheadId, status?.track_id])

  useEffect(
    () => () => {
      cancelAnimationFrame(dragFrame.current)
      cancelMotion.current?.()
    },
    [],
  )

  const shown = useMemo(() => {
    if (!displayed || !status || displayed.track_id !== status.track_id) return displayed
    // a track Spotify announces bare keeps the title and cover it is already shown with
    const filled = {
      track_image: displayed.track_image,
      track_name: status.track_name || displayed.track_name,
      track_artist: status.track_artist || displayed.track_artist,
      track_album: status.track_album || displayed.track_album,
    }
    const same = (Object.keys(filled) as (keyof typeof filled)[]).every(
      (k) => filled[k] === status[k],
    )
    return same ? status : { ...status, ...filled }
  }, [displayed, status])

  return {
    status: shown,
    pending:
      displayed?.track_id !== aheadId &&
      (transitioning ||
        !!(localPending && status && displayed && status.track_id !== displayed.track_id)),
    ref: node,
    drag,
    release,
  }
}
