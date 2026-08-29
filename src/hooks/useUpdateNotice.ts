import { useCallback, useEffect, useState } from 'react'
import type { ObserverStatus } from '@/api/types'

const SKIPPED_VERSION_KEY = 'mira.skippedVersion'
/** never the instant the screen settles; let the idle screen land first */
const MIN_DELAY_MS = 1500

export interface UpdateOffer {
  available: boolean
  mandatory: boolean
  version: string
  highlights: string[]
}

export interface UpdateEligibility extends UpdateOffer {
  skippedVersion: string
  /** the card is already up */
  open: boolean
  consentOpen: boolean
  /** something else owns the screen */
  busy: boolean
  loading: boolean
  status: ObserverStatus | null
}

/**
 * A mandatory update ignores a skip; an optional one stays skipped until a
 * newer version ships. Either way the card waits for a settled idle screen,
 * so it never lands over playback or a question.
 */
export function updateCardEligible(input: UpdateEligibility): boolean {
  const { available, mandatory, version, skippedVersion } = input
  if (!available) return false
  if (!mandatory && version === skippedVersion) return false
  if (input.open || input.consentOpen || input.busy || input.loading) return false
  const { status } = input
  return status != null && status.active !== true && status.setting_up !== true
}

export interface UseUpdateNoticeParams {
  status: ObserverStatus | null
  loading: boolean
  open: boolean
  consentOpen: boolean
  busy: boolean
  /** epoch ms before which the card must not reappear */
  remindAt: number
  onShow: () => void
  onDismiss: () => void
}

export interface UpdateNotice extends UpdateOffer {
  /** drop this version until a newer one ships */
  skip: () => void
}

/**
 * The "there is a new version" card: what the daemon is offering, and when
 * that offer is worth interrupting for.
 */
export function useUpdateNotice(params: UseUpdateNoticeParams): UpdateNotice {
  const { status, loading, open, consentOpen, busy, remindAt, onShow, onDismiss } = params

  const [offer, setOffer] = useState<UpdateOffer>({
    available: false,
    mandatory: false,
    version: '',
    highlights: [],
  })

  const available = status?.update_available
  const mandatory = status?.update_mandatory
  const version = status?.latest_version
  const highlights = status?.latest_highlights
  useEffect(() => {
    setOffer((prev) => {
      const next: UpdateOffer = {
        available: typeof available === 'boolean' ? available : prev.available,
        mandatory: typeof mandatory === 'boolean' ? mandatory : prev.mandatory,
        version: version || prev.version,
        highlights: highlights?.length ? highlights : prev.highlights,
      }
      // the daemon re-sends the same offer on every poll, in a fresh object;
      // returning prev unchanged is what stops that becoming a render
      const unchanged =
        next.available === prev.available &&
        next.mandatory === prev.mandatory &&
        next.version === prev.version &&
        next.highlights.length === prev.highlights.length &&
        next.highlights.every((line, i) => line === prev.highlights[i])
      return unchanged ? prev : next
    })
  }, [available, mandatory, version, highlights])

  const [skippedVersion, setSkippedVersion] = useState(() => {
    try {
      return window.localStorage.getItem(SKIPPED_VERSION_KEY) ?? ''
    } catch {
      return ''
    }
  })

  const eligible = updateCardEligible({
    ...offer,
    skippedVersion,
    open,
    consentOpen,
    busy,
    loading,
    status,
  })

  useEffect(() => {
    if (!eligible) return
    const t = window.setTimeout(onShow, Math.max(MIN_DELAY_MS, remindAt - Date.now()))
    return () => window.clearTimeout(t)
  }, [eligible, remindAt, onShow])

  // playback starting is the user telling us they want the device, not a
  // changelog
  const playing = status?.active === true
  useEffect(() => {
    if (open && playing) onDismiss()
  }, [open, playing, onDismiss])

  const skip = useCallback(() => {
    setSkippedVersion(offer.version)
    try {
      window.localStorage.setItem(SKIPPED_VERSION_KEY, offer.version)
    } catch {
      // storage broken
    }
    onDismiss()
  }, [offer.version, onDismiss])

  return { ...offer, skip }
}
