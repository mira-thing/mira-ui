import { useCallback, useEffect, useRef, useState } from 'react'
import type { ObserverStatusActive } from '@/api/types'
import type { RepeatMode } from '@/components/Menu'

const PREV_DOUBLE_TAP_MS = 1500
const TRANSITION_TIMEOUT_MS = 1200
const OPTIMISTIC_SAFETY_TIMEOUT_MS = 3000

interface OptimisticValue<T> {
  value: T
  at: number
}

interface TrackTransition {
  fromTrackId: string
  at: number
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

  useEffect(() => {
    if (!trackTransition) return
    const t = window.setTimeout(() => setTrackTransition(null), TRANSITION_TIMEOUT_MS + 50)
    return () => window.clearTimeout(t)
  }, [trackTransition])

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

  const transitioning =
    trackTransition != null && status != null && status.track_id === trackTransition.fromTrackId

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

  const onPrev = useCallback(() => {
    const now = Date.now()
    const recent = now - lastPrevAtRef.current < PREV_DOUBLE_TAP_MS
    lastPrevAtRef.current = now
    if (recent) {
      // second press within window > actual prev
      setTrackTransition({ fromTrackId: status?.track_id ?? '', at: now })
      void Promise.resolve(prev()).catch((err) => {
        setTrackTransition(null)
        reportCommandError('Previous failed', err)
      })
    } else {
      // first press > rewind to start of current track
      void Promise.resolve(seek(0)).catch((err) => reportCommandError('Seek failed', err))
    }
  }, [prev, reportCommandError, seek, status?.track_id])

  const onPrevTrack = useCallback(() => {
    setTrackTransition({ fromTrackId: status?.track_id ?? '', at: Date.now() })
    void Promise.resolve(prev()).catch((err) => {
      setTrackTransition(null)
      reportCommandError('Previous failed', err)
    })
  }, [prev, reportCommandError, status?.track_id])

  const onNext = useCallback(() => {
    setTrackTransition({ fromTrackId: status?.track_id ?? '', at: Date.now() })
    void Promise.resolve(next()).catch((err) => {
      setTrackTransition(null)
      reportCommandError('Next failed', err)
    })
  }, [next, reportCommandError, status?.track_id])

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
    onPlayPause,
    onPrev,
    onPrevTrack,
    onNext,
    onToggleShuffle,
    onDJSignal,
    onCycleRepeat,
  }
}
