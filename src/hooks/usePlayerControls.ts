import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ObserverStatusActive } from '@/api/types'
import type { RepeatMode } from '@/components/Menu'

const PREV_DOUBLE_TAP_MS = 1500
const TRANSITION_TIMEOUT_MS = 1200
const OPTIMISTIC_SAFETY_TIMEOUT_MS = 3000

interface OptimisticValue<T> {
  value: T
  at: number
}

export interface TrackTransition {
  fromTrackId: string
  at: number
  direction: -1 | 1
}

interface SkipRequest {
  command: () => Promise<void> | void
  failed: (err: unknown) => void
}

export interface UsePlayerControlsParams {
  status: ObserverStatusActive | null
  play: () => Promise<void> | void
  pause: () => Promise<void> | void
  next: () => Promise<void> | void
  prev: () => Promise<void> | void
  seek: (positionMs: number) => Promise<void> | void
  setShuffle: (on: boolean) => Promise<void> | void
  djSignal?: () => Promise<void> | void
  setRepeat: (mode: RepeatMode) => Promise<void> | void
  onCommandError?: (message: string) => void
}

export interface UsePlayerControlsResult {
  isPaused: boolean
  shuffle: boolean
  repeat: RepeatMode
  transitioning: boolean
  trackTransition: TrackTransition | null
  onPlayPause: () => void
  onPrev: () => void
  onPrevTrack: () => void // straight to prev track (swipe gestures)
  onNext: () => void
  onToggleShuffle: () => void
  onDJSignal: () => void
  onCycleRepeat: () => void
}

export function usePlayerControls(params: UsePlayerControlsParams): UsePlayerControlsResult {
  const { status, play, pause, next, prev, seek, setShuffle, djSignal, setRepeat, onCommandError } =
    params

  const [optimisticPause, setOptimisticPause] = useState<OptimisticValue<boolean> | null>(null)
  const [optimisticShuffle, setOptimisticShuffle] = useState<OptimisticValue<boolean> | null>(null)
  const [optimisticRepeat, setOptimisticRepeat] = useState<OptimisticValue<RepeatMode> | null>(null)
  const [trackTransition, setTrackTransition] = useState<TrackTransition | null>(null)
  const [skipPending, setSkipPending] = useState(false)
  const skips = useRef<SkipRequest[]>([])
  const activeSkip = useRef<{
    from: string
    confirm: () => void
    cancel: () => void
  } | null>(null)
  const statusRef = useRef(status)
  const mounted = useRef(true)
  useLayoutEffect(() => {
    statusRef.current = status
  })

  // one command in flight at a time
  const runSkip = useCallback(function runSkip() {
    const job = skips.current[0]
    if (!mounted.current || !job || activeSkip.current) return
    let acknowledged = false
    let confirmed = false
    let timer = 0
    const finish = () => {
      if (!mounted.current || activeSkip.current !== active) return
      window.clearTimeout(timer)
      activeSkip.current = null
      skips.current.shift()
      setSkipPending(skips.current.length > 0)
      if (skips.current.length) runSkip()
      else setTrackTransition(null)
    }
    const active = {
      from: statusRef.current?.track_id ?? '',
      confirm: () => {
        confirmed = true
        if (skips.current.length === 1) setSkipPending(false)
        if (acknowledged) finish()
      },
      cancel: () => window.clearTimeout(timer),
    }
    activeSkip.current = active
    timer = window.setTimeout(() => {
      if (activeSkip.current !== active) return
      if (!confirmed) skips.current = []
      finish()
      if (!confirmed) job.failed(new Error('Skip response timed out'))
    }, 8000)
    void (async () => {
      try {
        await job.command()
        if (!mounted.current || activeSkip.current !== active) return
        acknowledged = true
        window.clearTimeout(timer)
        if (confirmed) finish()
        else timer = window.setTimeout(finish, TRANSITION_TIMEOUT_MS + 50)
      } catch (err) {
        if (!mounted.current || activeSkip.current !== active) return
        finish()
        job.failed(err)
      }
    })()
  }, [])

  useEffect(() => {
    const active = activeSkip.current
    if (active && status && status.track_id !== active.from) active.confirm()
  }, [status?.track_id, status])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      activeSkip.current?.cancel()
      activeSkip.current = null
      skips.current = []
    }
  }, [])

  const lastPrevAtRef = useRef(0)

  useEffect(() => {
    if (!optimisticPause) return
    const t = window.setTimeout(() => setOptimisticPause(null), OPTIMISTIC_SAFETY_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [optimisticPause])

  useEffect(() => {
    if (!optimisticShuffle) return
    const t = window.setTimeout(() => setOptimisticShuffle(null), OPTIMISTIC_SAFETY_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [optimisticShuffle])

  useEffect(() => {
    if (!optimisticRepeat) return
    const t = window.setTimeout(() => setOptimisticRepeat(null), OPTIMISTIC_SAFETY_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [optimisticRepeat])

  const pauseFromStatus = status?.is_paused ?? false
  const optimisticPauseActive = optimisticPause != null && pauseFromStatus !== optimisticPause.value
  const isPaused =
    optimisticPauseActive && optimisticPause ? optimisticPause.value : pauseFromStatus

  // hold the optimistic value until the server reports the target
  const shuffleFromStatus = status?.shuffle ?? false
  const optimisticShuffleActive =
    optimisticShuffle != null && shuffleFromStatus !== optimisticShuffle.value
  const shuffle =
    optimisticShuffleActive && optimisticShuffle ? optimisticShuffle.value : shuffleFromStatus

  const repeatFromStatus: RepeatMode = status?.repeat_track
    ? 'track'
    : status?.repeat_context
      ? 'context'
      : 'off'
  const optimisticRepeatActive =
    optimisticRepeat != null && repeatFromStatus !== optimisticRepeat.value
  const repeat =
    optimisticRepeatActive && optimisticRepeat ? optimisticRepeat.value : repeatFromStatus

  const transitioning = skipPending && status != null

  const reportCommandError = useCallback(
    (message: string, err: unknown) => {
      console.warn(message, err)
      onCommandError?.(message)
    },
    [onCommandError],
  )

  const onPlayPause = useCallback(() => {
    const nextPaused = !isPaused
    setOptimisticPause({ value: nextPaused, at: Date.now() })
    const command = nextPaused ? pause : play
    void Promise.resolve(command()).catch((err) => {
      setOptimisticPause(null)
      reportCommandError('Play/pause failed', err)
    })
  }, [isPaused, pause, play, reportCommandError])

  const skip = useCallback(
    (direction: -1 | 1) => {
      setTrackTransition({
        fromTrackId: statusRef.current?.track_id ?? '',
        at: Date.now(),
        direction,
      })
      setSkipPending(true)
      skips.current.push({
        command: direction === -1 ? next : prev,
        failed: (err) =>
          reportCommandError(direction === -1 ? 'Next failed' : 'Previous failed', err),
      })
      runSkip()
    },
    [next, prev, reportCommandError, runSkip],
  )

  const onPrev = useCallback(() => {
    const now = Date.now()
    const recent = now - lastPrevAtRef.current < PREV_DOUBLE_TAP_MS
    lastPrevAtRef.current = now
    if (recent) {
      // second press within window > actual prev
      skip(1)
    } else {
      // first press > rewind to start of current track
      void Promise.resolve(seek(0)).catch((err) => reportCommandError('Seek failed', err))
    }
  }, [skip, reportCommandError, seek])

  const onPrevTrack = useCallback(() => {
    skip(1)
  }, [skip])

  const onNext = useCallback(() => {
    skip(-1)
  }, [skip])

  const onToggleShuffle = useCallback(() => {
    const nextShuffle = !shuffle
    setOptimisticShuffle({ value: nextShuffle, at: Date.now() })
    void Promise.resolve(setShuffle(nextShuffle)).catch((err) => {
      setOptimisticShuffle(null)
      reportCommandError('Shuffle failed', err)
    })
  }, [reportCommandError, setShuffle, shuffle])

  // nothing to predict; the new set arrives on the next status update
  const onDJSignal = useCallback(() => {
    if (!djSignal) return
    void Promise.resolve(djSignal()).catch((err) => {
      reportCommandError('Switching DJ set failed', err)
    })
  }, [djSignal, reportCommandError])

  const onCycleRepeat = useCallback(() => {
    const nextMode: RepeatMode =
      repeat === 'off' ? 'context' : repeat === 'context' ? 'track' : 'off'
    setOptimisticRepeat({ value: nextMode, at: Date.now() })
    void Promise.resolve(setRepeat(nextMode)).catch((err) => {
      setOptimisticRepeat(null)
      reportCommandError('Repeat failed', err)
    })
  }, [repeat, reportCommandError, setRepeat])

  return {
    isPaused,
    shuffle,
    repeat,
    transitioning,
    trackTransition,
    onPlayPause,
    onPrev,
    onPrevTrack,
    onNext,
    onToggleShuffle,
    onDJSignal,
    onCycleRepeat,
  }
}
