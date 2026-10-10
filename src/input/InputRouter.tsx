import { useEffect, useState, type ReactNode } from 'react'
import { createInputRouter, InputRouterContext } from './router'

/**
 * Owns the one window listener for the knob and the one for its press, and hands each
 * input to the topmost scope that wants it. See `useKnobScope`.
 */
export function InputRouter({ children }: { children: ReactNode }) {
  const [router] = useState(createInputRouter)
  useEffect(() => router.attach(window), [router])
  return <InputRouterContext.Provider value={router}>{children}</InputRouterContext.Provider>
}
