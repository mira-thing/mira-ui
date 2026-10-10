import { useEffect, useRef, useState, type ReactNode, type TransitionEvent } from 'react'
import { usePanelPaintCache } from '@/components/AmbientGround'
import type { ThemeInput } from '@/theme/theme'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { useUiScale } from '@/uiScale'
import { PageActiveContext } from './pageActive'
import { useRouteBack } from './routeBack'
import type { PageEntry, PageId } from './usePages'
import styles from './PageShell.module.scss'

// past the 300ms fade, for when transitionend never comes (display off, tab hidden)
const LEAVE_FALLBACK_MS = 350
const FORCED_KEY = -1

export interface PageShellProps<Id extends string = PageId> {
  /** the bottom of the stack; stays mounted, hidden, while a page covers it */
  root: PageEntry<Id>
  current: PageEntry<Id>
  /** the entry that last left the top; animated out, then unmounted */
  previous: PageEntry<Id> | null
  /** dev: shown in place of the stack, swapped in without a transition */
  forcedPage?: Id | null
  /** pops the stack; Back reaches it only after every page's own handler declines */
  onBack?: () => boolean
  renderPage: (id: Id) => ReactNode
  /** drawn over every page, inside the shell's own container */
  overlays?: ReactNode
  /** what the shell's theme follows; idle without art */
  theme?: ThemeInput
  /** re-rasterises the glass panels when it changes; the page id is deliberately not in it */
  paintKey?: string
}

/**
 * Renders the current page, plus the one it replaced while that one animates out, plus the
 * root, which never unmounts. An entering page mounts inactive and turns active a frame later.
 * Its root is the themed root: the ambient ground and the glass paint cache span every page.
 */
export function PageShell<Id extends string = PageId>({
  root,
  current,
  previous,
  forcedPage = null,
  onBack,
  renderPage,
  overlays,
  theme,
  paintKey = '',
}: PageShellProps<Id>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const uiScale = useUiScale()
  usePanelPaintCache(rootRef, paintKey, uiScale)
  useRouteBack(() => forcedPage === null && (onBack?.() ?? false))
  const shown = forcedPage === null ? current : { id: forcedPage, key: FORCED_KEY }
  const [enteredKey, setEnteredKey] = useState(shown.key)
  // a shell mounting mid-stack has nothing to animate out
  const [leftKey, setLeftKey] = useState(previous?.key ?? null)

  // a forced page drops whatever was leaving, so un-forcing has nothing stale to animate
  if (forcedPage !== null && previous && previous.key !== leftKey) setLeftKey(previous.key)

  const entering = forcedPage === null && shown.key !== enteredKey
  const leaving = forcedPage === null && previous && previous.key !== leftKey ? previous : null
  const leavingKey = leaving?.key ?? null

  useEffect(() => {
    if (!entering) return
    const frame = window.requestAnimationFrame(() => setEnteredKey(shown.key))
    return () => window.cancelAnimationFrame(frame)
  }, [entering, shown.key])

  useEffect(() => {
    if (leavingKey === null) return
    const timer = window.setTimeout(() => setLeftKey(leavingKey), LEAVE_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [leavingKey])

  const onLeft = (e: TransitionEvent<HTMLDivElement>) => {
    // a page's own children transition too, and their events bubble up here
    if (e.target !== e.currentTarget || e.propertyName !== 'opacity') return
    setLeftKey(leavingKey)
  }

  // root first, then by key, so a node never moves (which would cut its transition short)
  const above = (leaving ? [leaving, shown] : [shown]).filter((e) => e.key !== root.key)
  const mounted = [root, ...above.sort((a, b) => a.key - b.key)]

  return (
    <ThemeProvider {...theme} ref={rootRef} className={styles.shell}>
      {mounted.map((entry) => {
        const isCurrent = entry.key === shown.key
        const isLeaving = entry.key === leavingKey
        const inactive = !isCurrent || entering
        const covered = !isCurrent && !isLeaving
        return (
          <div
            key={entry.key}
            className={[
              styles.page,
              inactive ? styles.pageInactive : '',
              covered ? styles.pageCovered : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onTransitionEnd={isLeaving ? onLeft : undefined}
          >
            <PageActiveContext.Provider value={isCurrent}>
              {renderPage(entry.id)}
            </PageActiveContext.Provider>
          </div>
        )
      })}
      {overlays}
    </ThemeProvider>
  )
}
