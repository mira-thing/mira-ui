import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NoLyricsView } from '../NoLyricsView'
import { activeStatus } from '../../../__tests__/fixtures/observer'
import { NarrationContext, type DJNarration } from '@/hooks/useDJNarration'
import type { ObserverStatusActive } from '@/api/types'

// what App provides while the DJ is speaking
const talking: DJNarration = { narrating: true, title: 'Up next', artist: 'DJ X' }

function whileTalking(node: React.ReactNode) {
  return <NarrationContext.Provider value={talking}>{node}</NarrationContext.Provider>
}

describe('NoLyricsView', () => {
  it('shows the real track when the DJ is not talking', () => {
    render(<NoLyricsView status={activeStatus} />)
    expect(screen.getByText('Test Song')).toBeInTheDocument()
    expect(screen.getByText('Test Artist')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'DJ' })).toBeNull()
  })

  it('presents the DJ instead of the upcoming song while talking', () => {
    // during the hold, status has already advanced to the next song - none of it may leak
    const nextSong: ObserverStatusActive = {
      ...activeStatus,
      track_name: 'Joshua Tree',
      track_artist: 'Cautious Clay',
      track_image: 'https://x/next.jpg',
    }
    render(whileTalking(<NoLyricsView status={nextSong} />))

    expect(screen.getByText('Up next')).toBeInTheDocument()
    expect(screen.getByText('DJ X')).toBeInTheDocument()
    expect(screen.queryByText('Joshua Tree')).toBeNull()
    expect(screen.queryByText('Cautious Clay')).toBeNull()
    expect(screen.getAllByRole('img', { name: 'DJ' }).length).toBeGreaterThan(0)
  })

  it('suppresses the next track artwork while talking', () => {
    const nextSong: ObserverStatusActive = {
      ...activeStatus,
      track_image: 'https://x/next.jpg',
    }
    const { container } = render(whileTalking(<NoLyricsView status={nextSong} />))
    expect(container.querySelector('img[src="https://x/next.jpg"]')).toBeNull()
  })
})
