import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Lyrics } from '../Lyrics'
import { __resetLyricsCache } from '../../../hooks/useLyrics'
import { server } from '../../../__tests__/msw-server'
import { activeStatus } from '../../../__tests__/fixtures/observer'
import { NarrationContext } from '@/hooks/useDJNarration'

beforeEach(() => {
  __resetLyricsCache()
})

const TRACK_STATUS = {
  ...activeStatus,
  track_id: 'abc',
  duration: 60_000,
}

describe('lyrics rendered DOM', () => {
  it('renders one element per synced lyric line', async () => {
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'LINE_SYNCED',
          lines: [
            { startTimeMs: '0', words: 'First line' },
            { startTimeMs: '5000', words: 'Second line' },
            { startTimeMs: '10000', words: 'Third line' },
            { startTimeMs: '15000', words: 'Fourth line' },
          ],
        }),
      ),
    )

    render(<Lyrics status={TRACK_STATUS} />)

    await waitFor(() => expect(screen.getByText('First line')).toBeInTheDocument())
    expect(screen.getByText('Second line')).toBeInTheDocument()
    expect(screen.getByText('Third line')).toBeInTheDocument()
    expect(screen.getByText('Fourth line')).toBeInTheDocument()
  })

  it('fires onSeek with the lines start time when a synced line is clicked', async () => {
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'LINE_SYNCED',
          lines: [
            { startTimeMs: '0', words: 'L0' },
            { startTimeMs: '5000', words: 'L1' },
            { startTimeMs: '10000', words: 'L2' },
          ],
        }),
      ),
    )

    const onSeek = vi.fn()
    render(<Lyrics status={TRACK_STATUS} onSeek={onSeek} />)

    const line2 = await screen.findByText('L2')
    fireEvent.click(line2)

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(10_000)
  })

  it('does not make synced lines clickable when seeking is disallowed', async () => {
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'LINE_SYNCED',
          lines: [
            { startTimeMs: '0', words: 'L0' },
            { startTimeMs: '10000', words: 'L1' },
          ],
        }),
      ),
    )

    const onSeek = vi.fn()
    render(<Lyrics status={{ ...TRACK_STATUS, disallow_seek: true }} onSeek={onSeek} />)

    const line = await screen.findByText('L1')
    expect(line).not.toHaveAttribute('role', 'button')
    fireEvent.click(line)
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('shows the unsynced pill when the daemon returns unsynced lyrics', async () => {
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'UNSYNCED',
          lines: [
            { startTimeMs: '0', words: 'Whole song as one block' },
            { startTimeMs: '0', words: 'No per-line timing' },
          ],
        }),
      ),
    )

    render(<Lyrics status={TRACK_STATUS} />)

    const pill = await screen.findByLabelText('lyrics are not time-synced')
    expect(pill).toHaveTextContent(/unsynced/i)
  })

  it('does not make unsynced lines clickable (no perline timestamp to seek to)', async () => {
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'UNSYNCED',
          lines: [{ startTimeMs: '0', words: 'Whole block' }],
        }),
      ),
    )

    const onSeek = vi.fn()
    render(<Lyrics status={TRACK_STATUS} onSeek={onSeek} />)

    const line = await screen.findByText('Whole block')
    expect(line).not.toHaveAttribute('role', 'button')
    fireEvent.click(line)
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('marks the active line based on status.position', async () => {
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'LINE_SYNCED',
          lines: [
            { startTimeMs: '0', words: 'L0' },
            { startTimeMs: '5000', words: 'L1' },
            { startTimeMs: '10000', words: 'L2' },
            { startTimeMs: '15000', words: 'L3' },
          ],
        }),
      ),
    )

    render(
      <Lyrics
        status={{
          ...TRACK_STATUS,
          position: 7_000,
          // pin received_at so elapsed = 0, position can't drift past line 1
          received_at: Date.now() + 10_000,
          is_playing: false,
          is_paused: true,
        }}
      />,
    )
    await waitFor(() => expect(screen.getByText('L1').className).toMatch(/lineActive/))

    expect(screen.getByText('L0').className).not.toMatch(/lineActive/)
    expect(screen.getByText('L2').className).not.toMatch(/lineActive/)
  })

  it('renders an Instrumental placeholder when the only line says so', async () => {
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'LINE_SYNCED',
          lines: [{ startTimeMs: '0', words: 'Instrumental' }],
        }),
      ),
    )

    render(<Lyrics status={TRACK_STATUS} />)

    await waitFor(() => expect(screen.getByText(/instrumental/i)).toBeInTheDocument())
    expect(screen.getByText(/♪/)).toBeInTheDocument()
  })

  it('shows "No lyrics available" on a 404 (no lyrics for this track)', async () => {
    server.use(http.get('*/lyrics/abc', () => new HttpResponse(null, { status: 404 })))

    render(<Lyrics status={TRACK_STATUS} />)

    expect(await screen.findByText(/no lyrics available/i)).toBeInTheDocument()
  })

  it('shows "No lyrics available" while the DJ is talking', async () => {
    // must not show the previous track's lyrics, which useLyrics still holds
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'LINE_SYNCED',
          lines: [{ startTimeMs: '0', words: 'Stale line from the last song' }],
        }),
      ),
    )

    const { rerender } = render(<Lyrics status={TRACK_STATUS} />)
    expect(await screen.findByText('Stale line from the last song')).toBeInTheDocument()

    rerender(
      <NarrationContext.Provider value={{ narrating: true, title: 'Up next', artist: 'DJ X' }}>
        <Lyrics status={TRACK_STATUS} />
      </NarrationContext.Provider>,
    )

    expect(screen.getByText(/no lyrics available/i)).toBeInTheDocument()
    expect(screen.queryByText('Stale line from the last song')).toBeNull()
  })
})
