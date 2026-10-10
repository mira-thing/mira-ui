import { createContext } from 'react'
import { createStepFilter, knobDir, type KnobStep } from './knob'

// higher layers get the knob first
export const Layer = { base: 0, page: 10, modal: 90, system: 95 } as const

// a handler returning false passes the input down to the next scope; anything else consumes it
export interface KnobScope {
  layer: number
  enabled: boolean
  onStep?: (dir: KnobStep) => boolean | void
  onSelect?: () => boolean | void
}

export interface InputRouter {
  // `read` is called on every input, so a scope's handlers and `enabled` are always current
  register: (read: () => KnobScope) => () => void
  // every knob event, before the step filter and whoever owns the knob
  subscribeTurn: (onTurn: (dir: KnobStep) => void) => () => void
  attach: (target: Window) => () => void
}

interface Registered {
  seq: number
  read: () => KnobScope
}

export function createInputRouter(): InputRouter {
  const scopes: Registered[] = []
  const turnListeners = new Set<(dir: KnobStep) => void>()
  const accept = createStepFilter()
  let nextSeq = 0

  // top layer first; within a layer the latest registration wins, which is effect order
  const ordered = () =>
    scopes
      .map((s) => ({ seq: s.seq, scope: s.read() }))
      .filter((s) => s.scope.enabled)
      .sort((a, b) => b.scope.layer - a.scope.layer || b.seq - a.seq)
      .map((s) => s.scope)

  const onWheel = (e: WheelEvent) => {
    const dir = knobDir(e)
    if (dir === 0) return
    // keeps lyrics from scrolling. never stop propagation: the idle timer listens on window too
    e.preventDefault()
    for (const onTurn of turnListeners) onTurn(dir)
    if (!accept(dir)) return
    for (const scope of ordered()) {
      if (scope.onStep && scope.onStep(dir) !== false) return
    }
  }

  // bubble phase, so a capture-phase key shield still blocks it
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    for (const scope of ordered()) {
      if (scope.onSelect && scope.onSelect() !== false) {
        e.preventDefault()
        return
      }
    }
  }

  return {
    register(read) {
      const entry = { seq: nextSeq++, read }
      scopes.push(entry)
      return () => {
        const i = scopes.indexOf(entry)
        if (i >= 0) scopes.splice(i, 1)
      }
    },
    subscribeTurn(onTurn) {
      turnListeners.add(onTurn)
      return () => {
        turnListeners.delete(onTurn)
      }
    },
    attach(target) {
      target.addEventListener('wheel', onWheel, { passive: false, capture: true })
      target.addEventListener('keydown', onKeyDown)
      return () => {
        target.removeEventListener('wheel', onWheel, { capture: true })
        target.removeEventListener('keydown', onKeyDown)
      }
    },
  }
}

export const InputRouterContext = createContext<InputRouter | null>(null)
