import { useCallback, useEffect, useRef, useState } from 'react'
import { updateSettings } from '@/settings'
import type { ObserverStatus } from '@/api/types'

export type CheckinConsent = 'unset' | 'granted' | 'denied' | 'disabled'

export interface UseCheckinConsentParams {
  status: ObserverStatus | null
  loading: boolean
  /** the card is already up */
  open: boolean
  /** something else owns the screen */
  busy: boolean
  updateCardOpen: boolean
  onAsk: () => void
  onAnswered: () => void
}

export interface CheckinConsentState {
  choose: (consent: 'granted' | 'denied') => void
}

/**
 * Asks once, on a quiet screen, whether the daemon may check in. The daemon
 * owns the answer — this only decides when the question is worth asking, and
 * a `disabled` build or an already-recorded answer means never.
 */
export function useCheckinConsent(params: UseCheckinConsentParams): CheckinConsentState {
  const { status, loading, open, busy, updateCardOpen, onAsk, onAnswered } = params

  const [consent, setConsent] = useState<CheckinConsent | null>(null)
  const reported = status?.checkin_consent
  useEffect(() => {
    if (reported != null) setConsent(reported)
  }, [reported])

  // the daemon takes a moment to report the answer back, and asking twice in
  // that window would be worse than never asking
  const answeredRef = useRef(false)

  useEffect(() => {
    if (open || answeredRef.current) return
    if (consent !== 'unset') return
    if (busy || updateCardOpen) return
    if (loading || status == null || status.setting_up === true) return
    onAsk()
  }, [open, consent, busy, updateCardOpen, loading, status, onAsk])

  const choose = useCallback(
    (choice: 'granted' | 'denied') => {
      answeredRef.current = true
      updateSettings({ checkinConsent: choice })
      onAnswered()
    },
    [onAnswered],
  )

  return { choose }
}
