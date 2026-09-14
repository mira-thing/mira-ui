import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useOverlays, type OverlayId, type UseOverlaysParams } from '../useOverlays'

const render = (params: UseOverlaysParams = {}) => renderHook(() => useOverlays(params))

describe('useOverlays', () => {
  beforeEach(() => window.localStorage.clear())

  it('opens and closes by id', () => {
    const { result } = render()
    expect(result.current.isOpen('menu')).toBe(false)

    act(() => result.current.open('menu'))
    expect(result.current.isOpen('menu')).toBe(true)

    act(() => result.current.close('menu'))
    expect(result.current.isOpen('menu')).toBe(false)
  })

  it('toggles the real state, not what a dev screen forced on top of it', () => {
    const { result } = render({ forcedOpen: { powerMenu: true } })
    expect(result.current.isOpen('powerMenu')).toBe(true)

    // the hardware key flips the underlying state; the override still wins
    act(() => result.current.toggle('powerMenu'))
    expect(result.current.isOpen('powerMenu')).toBe(true)

    act(() => result.current.toggle('powerMenu'))
    expect(result.current.isOpen('powerMenu')).toBe(true)
  })

  describe('busy', () => {
    it('is false with nothing up', () => {
      expect(render().result.current.busy).toBe(false)
    })

    it('is true while an overlay owns the screen', () => {
      const { result } = render()
      act(() => result.current.open('settings'))
      expect(result.current.busy).toBe(true)
    })

    // both cards gate their own appearance on busy, so counting them would
    // mean each one blocks itself from coming back
    it.each(['consent', 'updateCard'] as const)('does not count the %s card', (id) => {
      const { result } = render()
      act(() => result.current.open(id))
      expect(result.current.isOpen(id)).toBe(true)
      expect(result.current.busy).toBe(false)
    })
  })

  describe('goBack', () => {
    it('reports nothing to close on an empty stack', () => {
      const { result } = render()
      let handled = true
      act(() => {
        handled = result.current.goBack()
      })
      expect(handled).toBe(false)
    })

    it('closes the topmost overlay and leaves the rest alone', () => {
      const { result } = render()
      act(() => {
        result.current.open('menu')
        result.current.open('settings')
      })

      act(() => void result.current.goBack())
      expect(result.current.isOpen('settings')).toBe(false)
      expect(result.current.isOpen('menu')).toBe(true)

      act(() => void result.current.goBack())
      expect(result.current.isOpen('menu')).toBe(false)
    })

    it('unwinds in a fixed order regardless of the order they opened', () => {
      const order: OverlayId[] = ['screensaver', 'report', 'debug', 'btMenu', 'powerMenu']
      const { result } = render()
      act(() => {
        result.current.open('powerMenu')
        result.current.open('btMenu')
        result.current.open('debug')
        result.current.openReport('r-1')
        result.current.open('screensaver')
      })

      for (const id of order) {
        expect(result.current.isOpen(id)).toBe(true)
        act(() => void result.current.goBack())
        expect(result.current.isOpen(id)).toBe(false)
      }
    })

    it('is swallowed by the consent card, which needs an answer', () => {
      const { result } = render()
      act(() => {
        result.current.open('menu')
        result.current.open('consent')
      })

      let handled = false
      act(() => {
        handled = result.current.goBack()
      })
      expect(handled).toBe(true)
      expect(result.current.isOpen('consent')).toBe(true)
      // and it does not fall through to what is underneath
      expect(result.current.isOpen('menu')).toBe(true)
    })

    it('treats a forced-open overlay as really open', () => {
      const { result } = render({ forcedOpen: { menu: true } })
      expect(result.current.busy).toBe(true)

      let handled = false
      act(() => {
        handled = result.current.goBack()
      })
      expect(handled).toBe(true)
    })
  })

  describe('closing remembers what it has to', () => {
    it('marks the sponsor screen shown, across boots', () => {
      const { result } = render()
      expect(result.current.sponsorShown()).toBe(false)

      act(() => result.current.close('sponsor'))
      expect(result.current.sponsorShown()).toBe(true)
      expect(window.localStorage.getItem('mira.sponsorShown')).toBe('1')

      // a later boot reads it back
      expect(render().result.current.sponsorShown()).toBe(true)
    })

    it('holds the update card off for a day when back dismisses it', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1_000_000)
      try {
        const { result } = render()
        act(() => result.current.open('updateCard'))
        expect(result.current.updateRemindAt()).toBe(0)

        act(() => void result.current.goBack())
        expect(result.current.isOpen('updateCard')).toBe(false)
        expect(result.current.updateRemindAt()).toBe(1_000_000 + 24 * 60 * 60 * 1000)
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not hold off when the card is closed some other way', () => {
      const { result } = render()
      act(() => result.current.open('updateCard'))
      act(() => result.current.close('updateCard'))
      expect(result.current.updateRemindAt()).toBe(0)
    })

    it('tells the caller which overlay closed', () => {
      const onClosed = vi.fn()
      const { result } = render({ onClosed })
      act(() => result.current.open('powerMenu'))
      act(() => void result.current.goBack())
      expect(onClosed).toHaveBeenCalledWith('powerMenu')
    })
  })

  it('carries the id the report dialog is showing', () => {
    const { result } = render()
    expect(result.current.isOpen('report')).toBe(false)

    act(() => result.current.openReport('report-42'))
    expect(result.current.reportId).toBe('report-42')
    expect(result.current.isOpen('report')).toBe(true)

    act(() => result.current.close('report'))
    expect(result.current.reportId).toBeNull()
  })

  it('keeps a stable identity so the back handler is not rebuilt each render', () => {
    // App feeds goBack to the hardware keys; an unstable one tears the
    // listeners down on every render
    const params: UseOverlaysParams = { forcedOpen: {}, onClosed: vi.fn() }
    const { result, rerender } = renderHook(() => useOverlays(params))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('remembers whether the screensaver was opened by hand or by the idle timer', () => {
    const { result } = render()
    expect(result.current.screensaverBy).toBe('manual')

    act(() => result.current.openScreensaver('auto'))
    expect(result.current.isOpen('screensaver')).toBe(true)
    expect(result.current.screensaverBy).toBe('auto')
  })
})
