import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLastArtUrl } from '../useLastArtUrl'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatus } from '@/api/types'

const idle: ObserverStatus = { active: false, message: 'no session' }

describe('useLastArtUrl', () => {
  beforeEach(() => window.localStorage.clear())

  const render = (status: ObserverStatus | null) =>
    renderHook(({ s }) => useLastArtUrl(s), { initialProps: { s: status } })

  it('has nothing to offer on a first boot', () => {
    expect(render(null).result.current).toBeNull()
  })

  it('remembers the art of whatever is playing', () => {
    const { result } = render({ ...activeStatus, track_image: 'https://art/one' })
    expect(result.current).toBe('https://art/one')
    expect(window.localStorage.getItem('mira.lastArtUrl')).toBe('https://art/one')
  })

  it('keeps the last art once playback stops', () => {
    const { result, rerender } = render({ ...activeStatus, track_image: 'https://art/one' })
    rerender({ s: idle })
    expect(result.current).toBe('https://art/one')
  })

  it('reads back what an earlier boot stored', () => {
    window.localStorage.setItem('mira.lastArtUrl', 'https://art/from-last-boot')
    expect(render(null).result.current).toBe('https://art/from-last-boot')
  })

  it('ignores an active track with no art rather than forgetting the old one', () => {
    const { result, rerender } = render({ ...activeStatus, track_image: 'https://art/one' })
    rerender({ s: { ...activeStatus, track_image: '' } })
    expect(result.current).toBe('https://art/one')
  })
})
