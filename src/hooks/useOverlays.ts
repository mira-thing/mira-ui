import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SPONSOR_SHOWN_KEY = 'mira.sponsorShown'
const UPDATE_REMIND_MS = 24 * 60 * 60 * 1000

export type OverlayId =
  | 'screensaver'
  | 'consent'
  | 'updateCard'
  | 'report'
  | 'sponsor'
  | 'debug'
  | 'deviceMenu'
  | 'btMenu'
  | 'settings'
  | 'powerMenu'
  | 'menu'

/**
 * Back closes the first of these that is open. A fixed order rather than a
 * stack of open order: these open each other (menu opens settings, settings
 * opens debug), and this is the order a user can actually unwind them in.
 */
const BACK_ORDER: readonly OverlayId[] = [
  'screensaver',
  'consent',
  'updateCard',
  'report',
  'sponsor',
  'debug',
  'deviceMenu',
  'btMenu',
  'settings',
  'powerMenu',
  'menu',
]

/**
 * Overlays that do not count as "busy". Both are one-shot cards that decide
 * for themselves when to appear, and both gate that decision on `busy` — so
 * counting them would mean each one blocks its own reappearance.
 */
const NOT_BUSY: readonly OverlayId[] = ['consent', 'updateCard']

export type ScreensaverBy = 'manual' | 'auto'

export interface UseOverlaysParams {
  /**
   * Dev screens force an overlay open without touching its state. Treated as
   * open everywhere here, so `busy` and back behave as they would for real.
   */
  forcedOpen?: Partial<Record<OverlayId, boolean>>
  /** fires after any close, for the dev screen to drop its own override */
  onClosed?: (id: OverlayId) => void
}

export interface Overlays {
  isOpen: (id: OverlayId) => boolean
  open: (id: OverlayId) => void
  close: (id: OverlayId) => void
  /** flips the real state, ignoring any dev override on top of it */
  toggle: (id: OverlayId) => void
  /** an overlay owns the screen: idle timers and one-shot cards stand down */
  busy: boolean
  /** closes the topmost overlay; false when there was nothing to close */
  goBack: () => boolean

  /** the support report dialog carries the id it is showing */
  reportId: string | null
  openReport: (id: string) => void

  /** an auto-opened screensaver yields to playback; a manual one stays */
  screensaverBy: ScreensaverBy
  openScreensaver: (by: ScreensaverBy) => void

  /** the sponsor screen is one-time, remembered across boots */
  sponsorShown: () => boolean
  /** earliest time the update card may come back, as an epoch ms */
  updateRemindAt: () => number
  remindLater: () => void
}

const NONE: Record<OverlayId, boolean> = {
  screensaver: false,
  consent: false,
  updateCard: false,
  report: false,
  sponsor: false,
  debug: false,
  deviceMenu: false,
  btMenu: false,
  settings: false,
  powerMenu: false,
  menu: false,
}

/**
 * Every menu, sheet, dialog, and card that can cover the screen, plus the
 * order the back button unwinds them in. Owns opening, closing, and what a
 * close has to remember; deciding *when* to open one is the caller's job.
 */
export function useOverlays({ forcedOpen, onClosed }: UseOverlaysParams = {}): Overlays {
  const [flags, setFlags] = useState(NONE)
  const [reportId, setReportId] = useState<string | null>(null)
  const [screensaverBy, setScreensaverBy] = useState<ScreensaverBy>('manual')

  const sponsorShownRef = useRef(false)
  useEffect(() => {
    try {
      sponsorShownRef.current = window.localStorage.getItem(SPONSOR_SHOWN_KEY) === '1'
    } catch {
      // no storage: treat it as shown rather than nagging every boot
      sponsorShownRef.current = true
    }
  }, [])
  const updateRemindAtRef = useRef(0)

  const isOpen = useCallback(
    (id: OverlayId) => forcedOpen?.[id] ?? (id === 'report' ? reportId !== null : flags[id]),
    [forcedOpen, flags, reportId],
  )

  const open = useCallback((id: OverlayId) => {
    setFlags((f) => ({ ...f, [id]: true }))
  }, [])

  const close = useCallback(
    (id: OverlayId) => {
      if (id === 'report') setReportId(null)
      if (id === 'sponsor') {
        sponsorShownRef.current = true
        try {
          window.localStorage.setItem(SPONSOR_SHOWN_KEY, '1')
        } catch {
          // ignore
        }
      }
      setFlags((f) => ({ ...f, [id]: false }))
      onClosed?.(id)
    },
    [onClosed],
  )

  const toggle = useCallback((id: OverlayId) => {
    setFlags((f) => ({ ...f, [id]: !f[id] }))
  }, [])

  const openReport = useCallback((id: string) => setReportId(id), [])

  const openScreensaver = useCallback((by: ScreensaverBy) => {
    setScreensaverBy(by)
    setFlags((f) => ({ ...f, screensaver: true }))
  }, [])

  const remindLater = useCallback(() => {
    updateRemindAtRef.current = Date.now() + UPDATE_REMIND_MS
    close('updateCard')
  }, [close])

  const goBack = useCallback(() => {
    for (const id of BACK_ORDER) {
      if (!isOpen(id)) continue
      // consent needs an explicit answer, so back neither dismisses it nor
      // falls through to whatever is underneath
      if (id === 'consent') return true
      if (id === 'updateCard') remindLater()
      else close(id)
      return true
    }
    return false
  }, [isOpen, close, remindLater])

  const busy = BACK_ORDER.some((id) => !NOT_BUSY.includes(id) && isOpen(id))

  return useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      busy,
      goBack,
      reportId,
      openReport,
      screensaverBy,
      openScreensaver,
      sponsorShown: () => sponsorShownRef.current,
      updateRemindAt: () => updateRemindAtRef.current,
      remindLater,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      busy,
      goBack,
      reportId,
      openReport,
      screensaverBy,
      openScreensaver,
      remindLater,
    ],
  )
}
