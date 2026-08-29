import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useDeviceSwitch, type UseDeviceSwitchParams } from '../useDeviceSwitch'
import { server } from '../../__tests__/msw-server'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ConnectDevice, ObserverStatus } from '@/api/types'

const idle: ObserverStatus = { active: false, message: 'no session' }

const speaker: ConnectDevice = {
  id: 'speaker-1',
  name: 'Kitchen',
  type: 'Speaker',
  volume: 50,
  volume_steps: 10,
  volume_disabled: false,
  is_active: false,
  is_offline: false,
  can_transfer: true,
}

describe('useDeviceSwitch', () => {
  function params(over: Partial<UseDeviceSwitchParams> = {}): UseDeviceSwitchParams {
    return {
      status: activeStatus,
      notify: vi.fn(),
      onPicked: vi.fn(),
      ...over,
    }
  }

  describe('announcing where playback went', () => {
    it('says nothing about the first status of the session', () => {
      const notify = vi.fn()
      renderHook(() => useDeviceSwitch(params({ notify })))
      expect(notify).not.toHaveBeenCalled()
    })

    it('names the device when playback moves', () => {
      const notify = vi.fn()
      const { rerender } = renderHook((p: UseDeviceSwitchParams) => useDeviceSwitch(p), {
        initialProps: params({ notify }),
      })

      const moved = { ...activeStatus, device_id: 'kitchen', device_name: 'Kitchen' }
      rerender(params({ status: moved, notify }))
      expect(notify).toHaveBeenCalledWith('Now playing on Kitchen', { variant: 'info' })
    })

    it('says what to do when playback stops entirely', () => {
      const notify = vi.fn()
      const { rerender } = renderHook((p: UseDeviceSwitchParams) => useDeviceSwitch(p), {
        initialProps: params({ notify }),
      })

      rerender(params({ status: idle, notify }))
      expect(notify).toHaveBeenCalledWith('Nothing is playing. Pick a device or start Spotify', {
        variant: 'info',
      })
    })

    it('stays quiet while the same device keeps playing', () => {
      const notify = vi.fn()
      const { rerender } = renderHook((p: UseDeviceSwitchParams) => useDeviceSwitch(p), {
        initialProps: params({ notify }),
      })

      // a fresh status object every poll, same device
      rerender(params({ status: { ...activeStatus, position: 90_000 }, notify }))
      expect(notify).not.toHaveBeenCalled()
    })
  })

  describe('picking a device', () => {
    it('closes the menu and hands off', async () => {
      const transfers: string[] = []
      server.use(
        http.post('*/connect/transfer', async ({ request }) => {
          transfers.push(((await request.json()) as { device_id: string }).device_id)
          return HttpResponse.json({ ok: true })
        }),
      )
      const notify = vi.fn()
      const onPicked = vi.fn()
      const { result } = renderHook(() => useDeviceSwitch(params({ notify, onPicked })))

      act(() => result.current(speaker))
      expect(onPicked).toHaveBeenCalledTimes(1)
      expect(notify).toHaveBeenCalledWith('Switching to Kitchen...', { variant: 'info' })
      await waitFor(() => expect(transfers).toEqual(['speaker-1']))
    })

    it('says so when the handoff fails', async () => {
      server.use(http.post('*/connect/transfer', () => HttpResponse.error()))
      const notify = vi.fn()
      const { result } = renderHook(() => useDeviceSwitch(params({ notify })))

      act(() => result.current(speaker))
      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith("Couldn't switch to Kitchen", { variant: 'error' }),
      )
    })
  })
})
