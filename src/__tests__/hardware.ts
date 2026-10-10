import { createElement, type ReactNode } from 'react'
import { act } from '@testing-library/react'
import type { KnobStep } from '@/input/knob'
import { InputRouter } from '@/input/InputRouter'

const KNOB_DELTA = 60

// clears the step filter's minimum interval
export const STEP_GAP_MS = 60
// clears its reversal debounce
export const REVERSAL_GAP_MS = 150

function fire<E extends Event>(event: E): E {
  act(() => {
    document.body.dispatchEvent(event)
  })
  return event
}

function key(k: string): KeyboardEvent {
  return fire(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true, cancelable: true }))
}

/** The Car Thing's knob, press and back button, dispatched the way the device sends them. */
export const hw = {
  // clockwise reports a negative deltaX
  turn: (dir: KnobStep): WheelEvent =>
    fire(
      new WheelEvent('wheel', {
        deltaX: dir === 1 ? -KNOB_DELTA : KNOB_DELTA,
        bubbles: true,
        cancelable: true,
      }),
    ),
  // for fake-timer suites; each step is followed by `advance(STEP_GAP_MS)`
  turnSteps(n: number, dir: KnobStep, { advance }: { advance: (ms: number) => unknown }): void {
    for (let i = 0; i < n; i++) {
      hw.turn(dir)
      advance(STEP_GAP_MS)
    }
  },
  press: (): KeyboardEvent => key('Enter'),
  back: (): KeyboardEvent => key('Escape'),
}

/** `wrapper` for render/renderHook, so knob scopes have a router to register with. */
export function withRouter({ children }: { children: ReactNode }) {
  return createElement(InputRouter, null, children)
}
