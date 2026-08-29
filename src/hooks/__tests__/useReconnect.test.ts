import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { resolveDropReason, useHeldStatus, type DropInput } from '../useReconnect'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatus } from '@/api/types'

const startingUp: ObserverStatus = { active: false, message: 'starting up' }
const noSession: ObserverStatus = { active: false, message: 'no session' }

describe('useHeldStatus', () => {
  it('holds the last active status through an inactive one', () => {
    const { result, rerender } = renderHook(({ status }) => useHeldStatus(status), {
      initialProps: { status: activeStatus as ObserverStatus | null },
    })
    expect(result.current).toEqual(activeStatus)

    rerender({ status: noSession })
    expect(result.current).toEqual(activeStatus)
  })

  it('starts empty and follows each new active status', () => {
    const { result, rerender } = renderHook(({ status }) => useHeldStatus(status), {
      initialProps: { status: null as ObserverStatus | null },
    })
    expect(result.current).toBeNull()

    const next = { ...activeStatus, track_name: 'Next Song' }
    rerender({ status: activeStatus })
    rerender({ status: next })
    expect(result.current?.track_name).toBe('Next Song')
  })
})

describe('resolveDropReason', () => {
  // a drop we expect to recover from: something played, the phone is still
  // reachable, but the daemon stopped reporting it
  function input(over: Partial<DropInput> = {}): DropInput {
    return {
      suppressed: false,
      held: activeStatus,
      status: noSession,
      online: true,
      connected: true,
      ...over,
    }
  }

  it('blames the websocket when it is down', () => {
    expect(resolveDropReason(input({ connected: false }))).toBe('ws')
  })

  it('blames the dealer while the daemon reports itself starting up', () => {
    expect(resolveDropReason(input({ status: startingUp }))).toBe('dealer')
  })

  it('is not a drop when a device is still playing', () => {
    expect(resolveDropReason(input({ status: activeStatus, connected: false }))).toBeNull()
  })

  it('is not a drop before anything has played', () => {
    expect(resolveDropReason(input({ held: null, connected: false }))).toBeNull()
  })

  it('is not a drop while the phone itself is unreachable', () => {
    // that is the offline screen's job, not the reconnect banner's
    expect(resolveDropReason(input({ online: false, connected: false }))).toBeNull()
    expect(resolveDropReason(input({ online: null, connected: false }))).toBeNull()
  })

  it('stands down when a dev screen is driving', () => {
    expect(resolveDropReason(input({ suppressed: true, connected: false }))).toBeNull()
  })

  it('is not a drop when the daemon is simply idle', () => {
    expect(resolveDropReason(input())).toBeNull()
  })
})
