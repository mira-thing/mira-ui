import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFlashReset } from '../useFlashReset'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatus } from '@/api/types'

const withFlash = (flash_id?: string): ObserverStatus => ({ ...activeStatus, flash_id })

describe('useFlashReset', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('mira.sponsorShown', '1')
    window.localStorage.setItem('mira.skippedVersion', '1.3.0')
  })

  it('asks for the sponsor again after a reflash, keeping everything else', () => {
    window.localStorage.setItem('mira.flashId', 'old')
    renderHook(() => useFlashReset(withFlash('new')))
    expect(window.localStorage.getItem('mira.sponsorShown')).toBeNull()
    expect(window.localStorage.getItem('mira.skippedVersion')).toBe('1.3.0')
    expect(window.localStorage.getItem('mira.flashId')).toBe('new')
  })

  it('treats an update from a firmware that never stored a flash as a reflash', () => {
    renderHook(() => useFlashReset(withFlash('new')))
    expect(window.localStorage.getItem('mira.sponsorShown')).toBeNull()
  })

  it('leaves a reboot alone', () => {
    window.localStorage.setItem('mira.flashId', 'same')
    renderHook(() => useFlashReset(withFlash('same')))
    expect(window.localStorage.getItem('mira.sponsorShown')).toBe('1')
  })

  it('does nothing until the daemon reports a flash', () => {
    const { rerender } = renderHook((s: ObserverStatus | null) => useFlashReset(s), {
      initialProps: null as ObserverStatus | null,
    })
    rerender(withFlash(undefined))
    rerender(withFlash(''))
    expect(window.localStorage.getItem('mira.sponsorShown')).toBe('1')
    expect(window.localStorage.getItem('mira.flashId')).toBeNull()
  })
})
