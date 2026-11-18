import { useEffect, useEffectEvent, useRef } from 'react'
import { useNavigation } from '@/app/navigation'
import { useControls } from '@/hooks/useControls'
import { useNotify } from '@/notify/notifyContext'
import { useOverlayState } from '@/overlays/overlayContext'

export interface LibraryPlayRequest {
  /** the playlist */
  uri: string
  skipToUri?: string
  shuffle?: boolean
}

// a pick closes the picker before its transfer lands, so a play outlives the close by this long
const PICK_GRACE_MS = 10_000

/**
 * Starts a playlist and opens the player over the page. With no active device the daemon has
 * nowhere to send it, so this opens the device picker and plays once a device comes up.
 */
export function useLibraryPlay(deviceActive: boolean): (req: LibraryPlayRequest) => void {
  const nav = useNavigation()
  const notify = useNotify()
  const overlays = useOverlayState()
  const { playContext } = useControls()
  // `until` is null while the picker is still open
  const pending = useRef<{ req: LibraryPlayRequest; until: number | null } | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = (req: LibraryPlayRequest) => {
    void playContext(req.uri, { skipToUri: req.skipToUri, shuffle: req.shuffle }).then(
      () => {
        if (mounted.current) nav.push({ id: 'player' })
      },
      () => notify("Couldn't start playback", { variant: 'error' }),
    )
  }

  const pickerOpen = overlays.isOpen('deviceMenu')
  useEffect(() => {
    if (!pickerOpen && pending.current?.until === null) {
      pending.current.until = Date.now() + PICK_GRACE_MS
    }
  }, [pickerOpen])

  const runPending = useEffectEvent(() => {
    const p = pending.current
    pending.current = null
    if (p && (p.until === null || Date.now() <= p.until)) run(p.req)
  })
  useEffect(() => {
    if (deviceActive) runPending()
  }, [deviceActive])

  return (req) => {
    if (deviceActive) {
      run(req)
      return
    }
    pending.current = { req, until: null }
    overlays.open('deviceMenu')
    notify('Pick a device to play on', { variant: 'info', icon: 'device' })
  }
}
