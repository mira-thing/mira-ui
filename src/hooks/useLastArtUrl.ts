import { useEffect, useState } from 'react'
import type { ObserverStatus } from '@/api/types'

const LAST_ART_KEY = 'mira.lastArtUrl'

/**
 * The most recent album art, remembered across boots. The screensaver uses it
 * as an ambient background, so it has to survive a cold start with nothing
 * playing — which is exactly when the screensaver is most likely to be up.
 */
export function useLastArtUrl(status: ObserverStatus | null): string | null {
  const [artUrl, setArtUrl] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(LAST_ART_KEY)
    } catch {
      return null
    }
  })

  const image = status?.active === true ? status.track_image : ''
  useEffect(() => {
    if (!image) return
    setArtUrl(image)
    try {
      window.localStorage.setItem(LAST_ART_KEY, image)
    } catch {
      // ignore
    }
  }, [image])

  return artUrl
}
