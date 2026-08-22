import { useEffect, useReducer } from 'react'
import { fetchObserverStatus, remoteStateToStatus } from '@/api/client'
import { subscribeConnection, subscribeEvents } from '@/api/eventBus'
import { isNarrationItem, seenNarrationFrom, type SeenNarration } from '@/hooks/useDJNarration'
import type { ApiEvent, ObserverStatus, RemoteStateWire, SetupProgress } from '@/api/types'

interface ObserverState {
  status: ObserverStatus | null
  loading: boolean
  error: string | null
  connected: boolean
  setupProgress: SetupProgress | null
  // last DJ narration seen on the wire; the reducer sees every action, renders may not
  narration: SeenNarration | null
  // id of the last actual song, which is what tells an outro narration from an intro
  lastSongId: string
}

type Action =
  | { type: 'loading' }
  | { type: 'status'; status: ObserverStatus }
  | { type: 'error'; error: string }
  | { type: 'ws'; connected: boolean }
  | { type: 'setup_progress'; progress: SetupProgress }

const initial: ObserverState = {
  status: null,
  loading: true,
  error: null,
  connected: false,
  setupProgress: null,
  narration: null,
  lastSongId: '',
}

function mergeProgress(
  prev: SetupProgress | null,
  next: SetupProgress | undefined,
): SetupProgress | null {
  if (!next) return prev
  if (prev && next.percent < prev.percent) return prev
  return next
}

function reducer(state: ObserverState, action: Action): ObserverState {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true }
    case 'status': {
      const incoming = action.status
      const prev = state.status?.setting_up
      const status: ObserverStatus =
        incoming.setting_up === undefined && prev !== undefined
          ? { ...incoming, setting_up: prev }
          : incoming
      const isNarr = status.active && isNarrationItem(status)
      // an outro carries the id of the song already playing and sits silent for seconds before
      // speaking; an intro starts at once, so waiting on its position would only add latency
      const isOutro = isNarr && status.track_id === state.lastSongId
      // carried forward so the song that supersedes a narration cannot erase it
      const narration =
        isNarr && (!isOutro || status.position > 0) ? seenNarrationFrom(status) : state.narration
      const lastSongId = status.active && !isNarr ? status.track_id : state.lastSongId

      return {
        ...state,
        status,
        loading: false,
        error: null,
        setupProgress: mergeProgress(state.setupProgress, incoming.setting_up_progress),
        narration,
        lastSongId,
      }
    }
    case 'error':
      return { ...state, error: action.error, loading: false }
    case 'ws':
      return { ...state, connected: action.connected }
    case 'setup_progress':
      return { ...state, setupProgress: mergeProgress(state.setupProgress, action.progress) }
  }
}

const POLL_MS = 3000
const POLL_TIMEOUT_MS = 5000

export function useObserver() {
  const [state, dispatch] = useReducer(reducer, initial)

  useEffect(() => {
    let cancelled = false
    let lastEventAt = 0

    const poll = async () => {
      const startedAt = Date.now()
      const ac = new AbortController()
      const timeoutId = window.setTimeout(() => ac.abort(), POLL_TIMEOUT_MS)
      try {
        const next = await fetchObserverStatus(ac.signal)
        if (!cancelled && lastEventAt < startedAt) dispatch({ type: 'status', status: next })
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        dispatch({ type: 'error', error: (err as Error).message })
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    void poll()
    const pollTimer = window.setInterval(poll, POLL_MS)

    const applyEvent = (evt: ApiEvent) => {
      if (evt.type === 'observer_track_changed' || evt.type === 'observer_state_changed') {
        const rs = evt.data as RemoteStateWire
        if (!rs || typeof rs !== 'object') return
        const status = remoteStateToStatus(rs)
        lastEventAt = Date.now()
        dispatch({ type: 'status', status })
        return
      }

      if (evt.type === 'setup_progress') {
        const p = evt.data as SetupProgress
        if (p && typeof p.percent === 'number') dispatch({ type: 'setup_progress', progress: p })
        return
      }

      // no device is active anymore, flip to idle immediately
      if (evt.type === 'observer_inactive') {
        lastEventAt = Date.now()
        dispatch({
          type: 'status',
          status: { active: false, message: 'no remote device is currently playing' },
        })
        return
      }

      // Snapshot-only contract
    }

    const unsubEvents = subscribeEvents(applyEvent)
    const unsubConn = subscribeConnection((c) => dispatch({ type: 'ws', connected: c }))

    return () => {
      cancelled = true
      window.clearInterval(pollTimer)
      unsubEvents()
      unsubConn()
    }
  }, [])

  return state
}
