import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { OverlayContext, useOverlayState } from '../overlayContext'
import { useOverlays } from '@/hooks/useOverlays'

describe('useOverlayState', () => {
  it('refuses to run outside a provider', () => {
    // an overlay that silently does nothing is worse to debug than a throw
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => renderHook(() => useOverlayState())).toThrow(/OverlayProvider/)
    } finally {
      quiet.mockRestore()
    }
  })

  it('gives consumers the stack the provider owns', () => {
    // one provider, two readers: opening through the hook is visible to both
    const { result } = renderHook(
      () => {
        const overlays = useOverlays()
        return { overlays }
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => children,
      },
    )

    const wrapper = ({ children }: { children: ReactNode }) => (
      <OverlayContext.Provider value={result.current.overlays}>{children}</OverlayContext.Provider>
    )
    const consumer = renderHook(() => useOverlayState(), { wrapper })

    expect(consumer.result.current.isOpen('menu')).toBe(false)
    act(() => consumer.result.current.open('menu'))
    expect(result.current.overlays.isOpen('menu')).toBe(true)
  })
})
