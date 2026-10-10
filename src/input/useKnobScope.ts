import { useContext, useEffect, useEffectEvent } from 'react'
import type { KnobStep } from './knob'
import { InputRouterContext, type KnobScope } from './router'

/**
 * Claims the knob (turn and press) while `enabled`, ahead of every lower layer. Registers
 * once per mount, so a re-render never reorders it among its peers. A no-op with no
 * `InputRouter` above it.
 */
export function useKnobScope(scope: KnobScope): void {
  const router = useContext(InputRouterContext)
  const read = useEffectEvent(() => scope)
  useEffect(() => {
    if (!router) return
    return router.register(() => read())
  }, [router])
}

/** Sees every knob event, including the ones the step filter drops or another scope owns. */
export function useKnobTurn(onTurn: (dir: KnobStep) => void): void {
  const router = useContext(InputRouterContext)
  const turn = useEffectEvent((dir: KnobStep) => onTurn(dir))
  useEffect(() => {
    if (!router) return
    return router.subscribeTurn((dir) => turn(dir))
  }, [router])
}
