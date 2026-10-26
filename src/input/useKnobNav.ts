import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { usePageActive } from '@/app/pageActive'
import type { KnobStep } from './knob'
import { Layer } from './router'
import { useKnobScope } from './useKnobScope'

export interface KnobNavOptions<K extends string> {
  /** the focusable items, in knob order; must be unique, so key a queue by item, not track URI */
  keys: readonly K[]
  /** first focus when there is no `restoreKey`; otherwise the first key */
  defaultKey?: K
  /** focus saved on the page's stack entry; read once, and wins over `defaultKey` */
  restoreKey?: string
  onSelect: (key: K) => void
  /** a disabled item still takes focus, but a press or tap on it does nothing */
  disabled?: (key: K) => boolean
  /** every focus change while the page is active, for saving with `Pages.setFocusKey` */
  onFocus?: (key: K) => void
  enabled?: boolean
  wrap?: boolean
  /** `modal` for a sheet over a page, so the pages own scopes stay behind it */
  layer?: number
}

/** Spreads onto a row: `focused` styles it, the rest is plain DOM. */
export interface KnobItemProps {
  focused: boolean
  disabled: boolean
  'aria-selected': boolean
  onClick: () => void
}

export interface KnobNav<K extends string> {
  /** undefined only while `keys` is empty */
  focusKey: K | undefined
  /** -1 only while `keys` is empty */
  focusIndex: number
  setFocus: (key: K) => void
  /** a tap focuses the item, then selects it */
  itemProps: (key: K) => KnobItemProps
}

interface Focus {
  key: string | undefined
  index: number
  // false until `keys` first has items, so `defaultKey` applies only to the initial focus
  settled: boolean
}

function resolve<K extends string>(
  focus: Focus,
  keys: readonly K[],
  defaultKey: K | undefined,
): { key: K; index: number } | null {
  if (keys.length === 0) return null
  let index = focus.key === undefined ? -1 : keys.indexOf(focus.key as K)
  if (index < 0 && !focus.settled && defaultKey !== undefined) index = keys.indexOf(defaultKey)
  if (index < 0) index = Math.min(Math.max(focus.index, 0), keys.length - 1)
  return { key: keys[index], index }
}

/**
 * Knob focus over a list of keys, on the `page` layer. Focus is a key, never DOM focus: it
 * follows its key when `keys` changes and holds the index when the key goes away. It clamps at
 * the ends unless `wrap`, and an empty list still swallows the knob so it never reaches volume.
 * Off while the page is not the active one.
 */
export function useKnobNav<K extends string>({
  keys,
  defaultKey,
  restoreKey,
  onSelect,
  disabled,
  onFocus,
  enabled = true,
  wrap = false,
  layer = Layer.page,
}: KnobNavOptions<K>): KnobNav<K> {
  const pageActive = usePageActive()
  const active = enabled && pageActive
  const [focus, setFocusState] = useState<Focus>(() => ({
    key: restoreKey ?? defaultKey,
    index: 0,
    settled: false,
  }))

  const current = resolve(focus, keys, defaultKey)
  if (current && (!focus.settled || current.key !== focus.key || current.index !== focus.index)) {
    setFocusState({ key: current.key, index: current.index, settled: true })
  }
  const focusKey = current?.key
  const focusIndex = current?.index ?? -1

  useEffect(() => {
    if (import.meta.env.DEV && new Set(keys).size !== keys.length) {
      console.warn('[useKnobNav] duplicate keys, focus cannot reach the later copies', keys)
    }
  }, [keys])

  const setFocus = (key: K) => {
    const index = keys.indexOf(key)
    if (index >= 0) setFocusState({ key, index, settled: true })
  }

  useKnobScope({
    layer,
    enabled: active,
    onStep: (dir: KnobStep) => {
      setFocusState((prev) => {
        const at = resolve(prev, keys, defaultKey)
        if (!at) return prev
        const n = keys.length
        const index = wrap ? (at.index + dir + n) % n : Math.min(Math.max(at.index + dir, 0), n - 1)
        return prev.settled && prev.key === keys[index] && prev.index === index
          ? prev
          : { key: keys[index], index, settled: true }
      })
      return true
    },
    onSelect: () => {
      if (focusKey !== undefined && !disabled?.(focusKey)) onSelect(focusKey)
      return true
    },
  })

  // the first focus is the seed itself, so there is nothing to save until it moves
  const reported = useRef<K | undefined>(undefined)
  const report = useEffectEvent((key: K) => onFocus?.(key))
  useEffect(() => {
    if (!active || focusKey === undefined || focusKey === reported.current) return
    const seeded = reported.current !== undefined
    reported.current = focusKey
    if (seeded) report(focusKey)
  }, [active, focusKey])

  return {
    focusKey,
    focusIndex,
    setFocus,
    itemProps: (key) => {
      const focused = key === focusKey
      const off = disabled?.(key) ?? false
      return {
        focused,
        disabled: off,
        'aria-selected': focused,
        onClick: () => {
          if (!active) return
          setFocus(key)
          if (!off) onSelect(key)
        },
      }
    },
  }
}
