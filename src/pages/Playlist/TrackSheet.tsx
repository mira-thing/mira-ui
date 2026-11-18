import { useState } from 'react'
import type { LibraryTrack } from '@/api/library'
import { useRouteBack } from '@/app/routeBack'
import { MenuGrid, MenuSheet, MenuTile } from '@/components/Menu'
import { Layer } from '@/input/router'
import { useKnobNav } from '@/input/useKnobNav'

type Action = 'play' | 'queue'
const ACTIONS: readonly Action[] = ['play', 'queue']

export interface TrackSheetProps {
  /** the track the sheet is for; null closes it */
  track: LibraryTrack | null
  onClose: () => void
  onPlayFromHere: (track: LibraryTrack) => void
  onAddToQueue: (track: LibraryTrack) => void
}

/** What to do with one track of a playlist, over the page and on the knob while open. */
export function TrackSheet({ track, onClose, onPlayFromHere, onAddToQueue }: TrackSheetProps) {
  const open = track !== null
  // the last track shown, so the sheet keeps its title while it slides away
  const [shown, setShown] = useState(track)
  if (track && track !== shown) setShown(track)

  const nav = useKnobNav({
    keys: ACTIONS,
    onSelect: (action) => {
      if (!track) return
      if (action === 'play') onPlayFromHere(track)
      else onAddToQueue(track)
    },
    enabled: open,
    layer: Layer.modal,
  })

  // every open starts on Play
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) nav.setFocus('play')
  }

  useRouteBack(() => {
    if (!open) return false
    onClose()
    return true
  })

  return (
    <MenuSheet open={open} onClose={onClose} title={shown?.name ?? ''}>
      <MenuGrid columns={2}>
        <MenuTile icon="play" label="Play from here" {...nav.itemProps('play')} />
        <MenuTile icon="queue" label="Add to queue" {...nav.itemProps('queue')} />
      </MenuGrid>
    </MenuSheet>
  )
}
