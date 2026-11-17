import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NavigationContext, useNavigation, type Navigation } from '../navigation'

describe('useNavigation', () => {
  it('hands a page the stack’s controls', () => {
    const nav: Navigation = {
      push: vi.fn(),
      pop: vi.fn(() => true),
      reset: vi.fn(),
      setFocusKey: vi.fn(),
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NavigationContext.Provider value={nav}>{children}</NavigationContext.Provider>
    )
    const { result } = renderHook(() => useNavigation(), { wrapper })

    result.current.push({ id: 'queue' })
    expect(nav.push).toHaveBeenCalledWith({ id: 'queue' })
    expect(result.current.pop()).toBe(true)
  })

  it('refuses to run outside a stack', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => renderHook(() => useNavigation())).toThrow(/NavigationContext/)
    } finally {
      quiet.mockRestore()
    }
  })
})
