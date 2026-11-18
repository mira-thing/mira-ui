import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Lyrics } from '../Lyrics'
import { __resetLyricsCache } from '../../../hooks/useLyrics'
import { server } from '../../../__tests__/msw-server'
import { activeStatus } from '../../../__tests__/fixtures/observer'
import { PageActiveContext } from '@/app/pageActive'
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
    const { rerender } = render(<Lyrics status={TRACK_STATUS} onSeek={onSeek} />)

    const line2 = await screen.findByText('L2')
    fireEvent.click(line2)

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(10_000)

    const nextSeek = vi.fn()
    rerender(<Lyrics status={TRACK_STATUS} onSeek={nextSeek} />)
    fireEvent.click(screen.getByText('L1'))
    expect(nextSeek).toHaveBeenCalledWith(5000)
    expect(onSeek).toHaveBeenCalledTimes(1)

    rerender(<Lyrics status={{ ...TRACK_STATUS, disallow_seek: true }} onSeek={nextSeek} />)
    expect(screen.getByText('L1')).not.toHaveAttribute('role', 'button')
    fireEvent.click(screen.getByText('L1'))
    expect(nextSeek).toHaveBeenCalledTimes(1)
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

describe('lyrics scroll', () => {
  const LINES = Array.from({ length: 20 }, (_, i) => ({
    startTimeMs: String(i * 5000),
    words: `Line ${i}`,
  }))
  const paused = (position: number) => ({
    ...TRACK_STATUS,
    duration: 100_000,
    position,
    received_at: Date.now() + 10_000,
    is_playing: false,
    is_paused: true,
  })

  // jsdom lays nothing out; give each line a 50px row so the active one sits below the fold
  beforeEach(() => {
    const row = (el: HTMLElement) => Array.from(el.parentElement?.children ?? []).indexOf(el)
    const props = {
      offsetTop: { get: (el: HTMLElement) => row(el) * 50 },
      offsetHeight: { get: () => 50 },
      clientHeight: { get: () => 200 },
      scrollHeight: { get: () => 1000 },
    }
    const restore = Object.entries(props).map(([name, { get }]) => {
      const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)
      Object.defineProperty(HTMLElement.prototype, name, {
        configurable: true,
        get() {
          return get(this)
        },
      })
      return () => {
        if (original) Object.defineProperty(HTMLElement.prototype, name, original)
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
      }
    })
    return () => restore.forEach((undo) => undo())
  })

  let stopRecording = () => {}
  afterEach(() => stopRecording())

  /** Records the list's transforms, returning those it animated to rather than jumped to. */
  function recordRolls() {
    const seen: { target: Node; style: string }[] = []
    const observer = new MutationObserver((records) => {
      for (const r of records) seen.push({ target: r.target, style: r.oldValue ?? '' })
    })
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
      attributeOldValue: true,
    })
    stopRecording = () => observer.disconnect()
    const transform = (style: string) => /translate\([^)]*\)/.exec(style)?.[0] ?? ''
    return () => {
      for (const r of observer.takeRecords())
        seen.push({ target: r.target, style: r.oldValue ?? '' })
      observer.disconnect()
      const list = screen.getByText('Line 0').parentElement!
      const styles = [
        ...seen.filter((r) => r.target === list).map((r) => r.style),
        list.getAttribute('style') ?? '',
      ]
      return styles
        .filter(
          (style, i) =>
            i > 0 &&
            transform(style) !== transform(styles[i - 1]) &&
            !style.includes('transition: none'),
        )
        .map(transform)
    }
  }

  it('places lyrics that just arrived without rolling them from the top', async () => {
    server.use(
      http.get('*/lyrics/abc', () => HttpResponse.json({ syncType: 'LINE_SYNCED', lines: LINES })),
    )
    const rolls = recordRolls()
    render(<Lyrics status={paused(52_000)} />)
    await waitFor(() => expect(screen.getByText('Line 10').className).toMatch(/lineActive/))

    expect(screen.getByText('Line 0').parentElement!.style.transform).toMatch(
      /translate\(0(px)?, -/,
    )
    expect(rolls()).toEqual([])
  })

  it('still rolls to the next line once placed', async () => {
    server.use(
      http.get('*/lyrics/abc', () => HttpResponse.json({ syncType: 'LINE_SYNCED', lines: LINES })),
    )
    const { rerender } = render(<Lyrics status={paused(52_000)} />)
    await waitFor(() => expect(screen.getByText('Line 10').className).toMatch(/lineActive/))

    const rolls = recordRolls()
    rerender(<Lyrics status={paused(57_000)} />)
    await waitFor(() => expect(screen.getByText('Line 11').className).toMatch(/lineActive/))

    expect(rolls()).toHaveLength(1)
  })
  it('jumps rather than rolls to a line more than a screen away', async () => {
    server.use(
      http.get('*/lyrics/abc', () => HttpResponse.json({ syncType: 'LINE_SYNCED', lines: LINES })),
    )
    const { rerender } = render(<Lyrics status={paused(52_000)} />)
    await waitFor(() => expect(screen.getByText('Line 10').className).toMatch(/lineActive/))

    const rolls = recordRolls()
    rerender(<Lyrics status={paused(92_000)} />)
    await waitFor(() => expect(screen.getByText('Line 18').className).toMatch(/lineActive/))

    expect(rolls()).toEqual([])
  })

  it('places a list that comes back with the same lyrics', async () => {
    server.use(
      http.get('*/lyrics/abc', () => HttpResponse.json({ syncType: 'LINE_SYNCED', lines: LINES })),
    )
    const shown = (narrating: boolean) => (
      <NarrationContext.Provider value={{ narrating, title: '', artist: '' }}>
        <Lyrics status={paused(52_000)} />
      </NarrationContext.Provider>
    )
    const { rerender } = render(shown(false))
    await waitFor(() => expect(screen.getByText('Line 10').className).toMatch(/lineActive/))

    rerender(shown(true))
    rerender(shown(false))
    expect(screen.getByText('Line 0').parentElement!.style.transform).toMatch(
      /translate\(0(px)?, -/,
    )
  })
})

describe('karaoke line', () => {
  it('runs its frame loop only while its page is active', async () => {
    server.use(
      http.get('*/lyrics/abc', () =>
        HttpResponse.json({
          syncType: 'LINE_SYNCED',
          lines: [
            {
              startTimeMs: '0',
              words: 'Sung line',
              syllables: [
                { startTimeMs: '0', word: 'Sung ' },
                { startTimeMs: '2000', word: 'line' },
              ],
            },
            { startTimeMs: '50000', words: 'Later line' },
          ],
        }),
      ),
    )
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const status = { ...TRACK_STATUS, position: 1000, is_playing: false, is_paused: true }
    const page = (active: boolean) => (
      <PageActiveContext.Provider value={active}>
        <Lyrics status={status} />
      </PageActiveContext.Provider>
    )

    const { rerender } = render(page(false))
    // the active line splits into syllables once it is the karaoke line
    await waitFor(() => expect(screen.getByText('line')).toBeInTheDocument())
    expect(raf).not.toHaveBeenCalled()

    rerender(page(true))
    expect(raf).toHaveBeenCalled()
    raf.mockRestore()
  })
})
