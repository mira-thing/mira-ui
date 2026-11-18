import { describe, expect, it } from 'vitest'
import type { QueueTrack } from '@/api/types'
import { upNextItems, upNextSummary } from '../upNext'

const t = (uri: string): QueueTrack => ({
  uri,
  track_id: '',
  name: uri,
  artist: '',
  album: '',
  image_url: '',
})
const tracks = (n: number) => Array.from({ length: n }, (_, i) => t(`spotify:track:${i}`))
const keys = (list: QueueTrack[]) => upNextItems(list).map((i) => i.key)

describe('upNextItems', () => {
  it('keys a track queued twice apart', () => {
    expect(keys([t('spotify:track:a'), t('spotify:track:a')])).toEqual([
      'spotify:track:a#0',
      'spotify:track:a#1',
    ])
  })

  it('keeps each key as the queue advances, so knob focus stays on its track', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((id) => t(`spotify:track:${id}`))
    expect(keys([b, c])).toEqual(keys([a, b, c]).slice(1))
  })

  it('drops DJ narration, which is not a track', () => {
    expect(keys([t('spotify:media:dj'), t('spotify:track:a')])).toEqual(['spotify:track:a#0'])
  })
})

describe('upNextSummary', () => {
  it('says the count, and that more may follow a full page from the daemon', () => {
    expect(upNextSummary([])).toBe('Nothing queued')
    expect(upNextSummary(tracks(3))).toBe('3 up next')
    expect(upNextSummary(tracks(10))).toBe('10+ up next')
  })

  it('judges a full page on what the daemon sent, narration included', () => {
    expect(upNextSummary([t('spotify:media:dj'), ...tracks(9)])).toBe('9+ up next')
    expect(upNextSummary([t('spotify:media:dj')])).toBe('Nothing queued')
  })
})
