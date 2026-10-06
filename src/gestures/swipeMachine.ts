// pure classifier for touch swipe gestures on the player view
//   one finger swipe across - next/prev track
//   two-finger up/down swipe   - toggle lyrics/album view

// 1 finger horizontal distance to commit a track skip
export const SWIPE_MIN_PX = 130
// 2 finger accumulated vertical distance to commit a view toggle
export const TWO_FINGER_MIN_PX = 24
// horizontal travel must beat vertical by this factor to count as a swipe
export const AXIS_RATIO = 1.5
// once 1 finger movement passes this we decide axis
export const AXIS_DECIDE_PX = 12

export type SwipeAction = 'next' | 'prev' | 'toggleView'

export const PHANTOM_TOUCH_MS = 3000

export interface TouchPoint {
  identifier: number
  clientX: number
  clientY: number
}

// stateful filter that drops phantom touches; feed it every touch event
export function createPhantomFilter(
  now: () => number = Date.now,
): (touches: readonly TouchPoint[], changed: readonly TouchPoint[]) => TouchPoint[] {
  const lastSeen = new Map<number, number>()
  return (touches, changed) => {
    const t = now()
    for (const c of changed) lastSeen.set(c.identifier, t)
    const present = new Set<number>()
    const live: TouchPoint[] = []
    for (const p of touches) {
      present.add(p.identifier)
      const seen = lastSeen.get(p.identifier)
      if (seen == null) {
        // an id we never saw start (listener attached mid-gesture): count it live
        lastSeen.set(p.identifier, t)
        live.push(p)
      } else if (t - seen <= PHANTOM_TOUCH_MS) {
        live.push(p)
      }
    }
    // ids gone from the list are really up; forget them so a reused id is fresh
    for (const id of Array.from(lastSeen.keys())) {
      if (!present.has(id)) lastSeen.delete(id)
    }
    return live
  }
}

export type SwipeState =
  | { kind: 'idle' }
  | {
      kind: 'tracking'
      startX: number
      startY: number
      lastX: number
      maxTouches: number
      mode: 'undecided' | 'vscroll' | 'horizontal' | 'committed'
      // two finger vertical accumulator
      lastCount: number
      lastY: number
      accumY: number
    }

export type SwipeEvent =
  | { type: 'start'; x: number; y: number; touches: number }
  | { type: 'move'; x: number; y: number; touches: number }
  | { type: 'end'; touches: number }

export interface SwipeResult {
  next: SwipeState
  action?: SwipeAction
}

export const INITIAL_SWIPE_STATE: SwipeState = { kind: 'idle' }

// start and move are both just position samples
function sample(state: SwipeState, x: number, y: number, touches: number): SwipeResult {
  if (state.kind !== 'tracking') {
    return {
      next: {
        kind: 'tracking',
        startX: x,
        startY: y,
        lastX: x,
        maxTouches: touches,
        mode: 'undecided',
        lastCount: touches,
        lastY: y,
        accumY: 0,
      },
    }
  }

  const maxTouches = Math.max(state.maxTouches, touches)
  const countChanged = touches !== state.lastCount
  const reachedTwoFirst = state.maxTouches < 2 && touches >= 2

  let accumY = state.accumY
  if (countChanged) {
    // reset the accumulator the first time two fingers appear
    if (reachedTwoFirst) accumY = 0
  } else {
    accumY += y - state.lastY
  }

  const base: SwipeState = { ...state, maxTouches, lastCount: touches, lastX: x, lastY: y, accumY }

  // two fingers only the vertical view toggle path is live
  if (maxTouches >= 2) {
    if (base.mode === 'committed') return { next: base }
    // commit only while two fingers are genuinely down
    if (touches >= 2 && Math.abs(accumY) > TWO_FINGER_MIN_PX) {
      return { next: { ...base, mode: 'committed' }, action: 'toggleView' }
    }
    return { next: base }
  }

  // single finger horizontal track skip
  if (base.mode !== 'undecided') return { next: base }
  const dx = x - state.startX
  const dy = y - state.startY
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)

  // a clear vertical lead means a scroll
  if (ady > AXIS_DECIDE_PX && ady > adx) {
    return { next: { ...base, mode: 'vscroll' } }
  }
  // committed horizontal swipe
  if (adx > AXIS_DECIDE_PX && adx > AXIS_RATIO * ady) {
    return { next: { ...base, mode: 'horizontal' } }
  }
  return { next: base }
}

export function classify(state: SwipeState, event: SwipeEvent): SwipeResult {
  switch (event.type) {
    case 'start':
      if (event.touches <= 1) {
        return sample(INITIAL_SWIPE_STATE, event.x, event.y, event.touches)
      }
      return sample(state, event.x, event.y, event.touches)
    case 'move':
      return sample(state, event.x, event.y, event.touches)
    case 'end':
      // wait until every finger is up before resetting
      if (event.touches > 0) return { next: state }
      if (state.kind === 'tracking' && state.maxTouches === 1 && state.mode === 'horizontal') {
        const dx = state.lastX - state.startX
        return {
          next: INITIAL_SWIPE_STATE,
          action: Math.abs(dx) >= SWIPE_MIN_PX ? (dx < 0 ? 'next' : 'prev') : undefined,
        }
      }
      return { next: INITIAL_SWIPE_STATE }
  }
}
