import { describe, expect, it } from 'vitest'
import {
  classify,
  INITIAL_SWIPE_STATE,
  type SwipeAction,
  type SwipeEvent,
  type SwipeState,
} from '@/gestures/swipeMachine'

// run a sequence of events through the machine
function run(events: SwipeEvent[]): { actions: SwipeAction[]; state: SwipeState } {
  let state = INITIAL_SWIPE_STATE
  const actions: SwipeAction[] = []
  for (const e of events) {
    const r = classify(state, e)
    state = r.next
    if (r.action) actions.push(r.action)
  }
  return { actions, state }
}

describe('swipeMachine', () => {
  it('1-finger swipe left -> next', () => {
    const { actions, state } = run([
      { type: 'start', x: 200, y: 100, touches: 1 },
      { type: 'move', x: 200, y: 100, touches: 1 },
      { type: 'move', x: 60, y: 102, touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual(['next'])
    expect(state).toEqual(INITIAL_SWIPE_STATE)
  })

  it('1-finger swipe right -> prev', () => {
    const { actions } = run([
      { type: 'start', x: 100, y: 100, touches: 1 },
      { type: 'move', x: 240, y: 105, touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual(['prev'])
  })

  it('only fires once per gesture (latched)', () => {
    const { actions } = run([
      { type: 'start', x: 200, y: 100, touches: 1 },
      { type: 'move', x: 130, y: 100, touches: 1 },
      { type: 'move', x: 60, y: 100, touches: 1 },
      { type: 'move', x: 10, y: 100, touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual(['next'])
  })

  it('vertical drag is left alone and locks out a later horizontal jerk', () => {
    const { actions } = run([
      { type: 'start', x: 100, y: 100, touches: 1 },
      { type: 'move', x: 105, y: 200, touches: 1 }, // clear vertical -> vscroll
      { type: 'move', x: 30, y: 205, touches: 1 }, // big horizontal, but locked
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual([])
  })

  it('a pure diagonal (45deg) commits nothing', () => {
    const { actions } = run([
      { type: 'start', x: 100, y: 100, touches: 1 },
      { type: 'move', x: 160, y: 160, touches: 1 },
      { type: 'move', x: 220, y: 220, touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual([])
  })

  it('a plain tap commits nothing', () => {
    const { actions, state } = run([
      { type: 'start', x: 150, y: 150, touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual([])
    expect(state).toEqual(INITIAL_SWIPE_STATE)
  })

  it('2-finger vertical swipe -> toggleView', () => {
    const { actions } = run([
      { type: 'start', x: 100, y: 100, touches: 2 },
      { type: 'move', x: 100, y: 150, touches: 2 },
    ])
    expect(actions).toEqual(['toggleView'])
  })

  it('2-finger toggle works when the second finger lands after the first', () => {
    const { actions } = run([
      { type: 'start', x: 100, y: 100, touches: 1 },
      { type: 'move', x: 100, y: 100, touches: 2 }, // 2nd finger -> re-anchor
      { type: 'move', x: 100, y: 150, touches: 2 },
    ])
    expect(actions).toEqual(['toggleView'])
  })

  it('a 2-finger horizontal swipe does not toggle (wrong axis)', () => {
    const { actions } = run([
      { type: 'start', x: 100, y: 100, touches: 2 },
      { type: 'move', x: 180, y: 102, touches: 2 },
      { type: 'end', touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual([])
  })

  it('small 2-finger movement does not toggle', () => {
    const { actions } = run([
      { type: 'start', x: 100, y: 100, touches: 2 },
      { type: 'move', x: 100, y: 120, touches: 2 },
      { type: 'end', touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual([])
  })

  it('commits through a one-finger flicker mid 2-finger swipe', () => {
    // panel briefly drops to one touch then recovers
    const { actions } = run([
      { type: 'start', x: 100, y: 100, touches: 2 },
      { type: 'move', x: 100, y: 115, touches: 2 }, // +15
      { type: 'move', x: 100, y: 118, touches: 1 }, // flicker out: skipped
      { type: 'move', x: 100, y: 120, touches: 2 }, // flicker recover: skipped
      { type: 'move', x: 100, y: 145, touches: 2 }, // +25 -> total 40 -> toggle
    ])
    expect(actions).toEqual(['toggleView'])
  })

  it('a stray second finger does not arm a later one-finger scroll', () => {
    const { actions } = run([
      { type: 'start', x: 100, y: 300, touches: 1 }, // scrolling lyrics, 1 finger
      { type: 'move', x: 100, y: 260, touches: 1 }, // scroll up 40
      { type: 'start', x: 100, y: 250, touches: 2 }, // stray 2nd finger resets accum
      { type: 'end', touches: 1 }, // 2nd finger lifts
      { type: 'move', x: 100, y: 180, touches: 1 }, // keep scrolling far, 1 finger
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual([])
  })

  it('a multi-touch gesture never fires a 1-finger track skip', () => {
    // two fingers down, then one lifts and the remaining finger swipes far
    const { actions } = run([
      { type: 'start', x: 200, y: 100, touches: 2 },
      { type: 'move', x: 200, y: 105, touches: 2 }, // below toggle threshold
      { type: 'move', x: 30, y: 100, touches: 1 }, // one finger left, big move
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual([])
  })

  it('does not reset until the last finger lifts', () => {
    const { state } = run([
      { type: 'start', x: 100, y: 100, touches: 2 },
      { type: 'end', touches: 1 },
    ])
    expect(state.kind).toBe('tracking')
  })

  it('recovers after a missed terminal touchend', () => {
    const { actions } = run([
      { type: 'start', x: 200, y: 100, touches: 1 },
      { type: 'move', x: 130, y: 100, touches: 1 },
      { type: 'start', x: 200, y: 100, touches: 1 },
      { type: 'move', x: 60, y: 100, touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual(['next'])
  })

  it.each([-129, -70, 70, 129])('does not skip for a small horizontal drag of %ipx', (dx) => {
    expect(
      run([
        { type: 'start', x: 300, y: 100, touches: 1 },
        { type: 'move', x: 300 + dx, y: 102, touches: 1 },
        { type: 'end', touches: 0 },
      ]).actions,
    ).toEqual([])
  })

  it('previews without skipping until release and cancels a drag returned near its origin', () => {
    const started = run([
      { type: 'start', x: 200, y: 100, touches: 1 },
      { type: 'move', x: 110, y: 102, touches: 1 },
    ])
    expect(started.actions).toEqual([])
    expect(started.state).toMatchObject({ mode: 'horizontal' })
    const back = classify(started.state, { type: 'move', x: 190, y: 102, touches: 1 })
    expect(classify(back.next, { type: 'end', touches: 0 }).action).toBeUndefined()
  })

  it('does not skip a drag that starts sideways and ends mostly down', () => {
    const { actions } = run([
      { type: 'start', x: 300, y: 100, touches: 1 },
      { type: 'move', x: 280, y: 102, touches: 1 },
      { type: 'move', x: 150, y: 300, touches: 1 },
      { type: 'end', touches: 0 },
    ])
    expect(actions).toEqual([])
  })
})

describe('createPhantomFilter', () => {
  const tp = (identifier: number, x = 0, y = 0) => ({ identifier, clientX: x, clientY: y })

  it('passes fresh touches through', async () => {
    const { createPhantomFilter } = await import('@/gestures/swipeMachine')
    const now = 1000
    const filter = createPhantomFilter(() => now)
    expect(filter([tp(1), tp(2)], [tp(1), tp(2)])).toHaveLength(2)
  })

  it('drops a ghost finger that stopped producing events (the swipe-latch bug)', async () => {
    const { createPhantomFilter, PHANTOM_TOUCH_MS } = await import('@/gestures/swipeMachine')
    let now = 1000
    const filter = createPhantomFilter(() => now)

    // ghost id 7 goes down and its touchend is lost
    filter([tp(7)], [tp(7)])

    // a real finger arrives
    now += PHANTOM_TOUCH_MS + 1
    const live = filter([tp(7), tp(8)], [tp(8)])
    expect(live.map((t) => t.identifier)).toEqual([8])
  })

  it('keeps a second finger alive while it keeps producing events', async () => {
    const { createPhantomFilter, PHANTOM_TOUCH_MS } = await import('@/gestures/swipeMachine')
    let now = 1000
    const filter = createPhantomFilter(() => now)

    filter([tp(1), tp(2)], [tp(1), tp(2)])
    // both fingers move periodically
    for (let i = 0; i < 5; i++) {
      now += PHANTOM_TOUCH_MS - 100
      const live = filter([tp(1), tp(2)], [tp(1), tp(2)])
      expect(live).toHaveLength(2)
    }
  })

  it('re-demotes only the stale finger, and a lifted id comes back fresh', async () => {
    const { createPhantomFilter, PHANTOM_TOUCH_MS } = await import('@/gestures/swipeMachine')
    let now = 1000
    const filter = createPhantomFilter(() => now)

    filter([tp(1), tp(2)], [tp(1), tp(2)])
    // only finger 1 keeps moving
    now += PHANTOM_TOUCH_MS + 1
    expect(filter([tp(1), tp(2)], [tp(1)]).map((t) => t.identifier)).toEqual([1])

    // finger 2 lifts
    filter([tp(1)], [tp(1)])
    now += 10
    expect(filter([tp(1), tp(2)], [tp(1), tp(2)])).toHaveLength(2)
  })
})
