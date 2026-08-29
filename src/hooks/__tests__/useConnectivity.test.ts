import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useConnectivity } from '../useConnectivity'
import type { KnownBluetoothDevice } from '@/api/types'

const bt = vi.hoisted(() => ({
  online: null as boolean | null,
  devices: null as KnownBluetoothDevice[] | null,
}))

vi.mock('../useBluetooth', () => ({
  useBluetooth: () => ({
    online: bt.online,
    carriers: null,
    pairing: null,
    lastDevice: null,
    trouble: null,
    setDiscoverable: vi.fn(),
    reconnectLast: vi.fn(),
  }),
}))

vi.mock('../useKnownDevices', () => ({
  useKnownDevices: () => ({ devices: bt.devices, refresh: vi.fn() }),
}))

function device(over: Partial<KnownBluetoothDevice> = {}): KnownBluetoothDevice {
  return {
    address: 'AA:BB:CC:DD:EE:FF',
    name: 'Pixel 7',
    starred: false,
    last_connected: '',
    connected: false,
    network: false,
    ...over,
  }
}

describe('useConnectivity', () => {
  beforeEach(() => {
    bt.online = null
    bt.devices = null
  })

  it('reports no known devices until the list loads', () => {
    const { result } = renderHook(() => useConnectivity())
    expect(result.current.hasKnownDevice).toBe(false)
    expect(result.current.btConnectedDevice).toBeNull()
    expect(result.current.topKnownDeviceName).toBeNull()
  })

  it('picks out the connected phone and the top of the list', () => {
    bt.devices = [
      device({ name: 'Pixel 7' }),
      device({ address: 'ZZ', name: 'S24', connected: true }),
    ]
    const { result } = renderHook(() => useConnectivity())
    expect(result.current.hasKnownDevice).toBe(true)
    expect(result.current.btConnectedDevice?.name).toBe('S24')
    expect(result.current.topKnownDeviceName).toBe('Pixel 7')
  })

  it('latches wasOnline so a dropped connection is not read as first-time setup', () => {
    const { result, rerender } = renderHook(() => useConnectivity())
    expect(result.current.wasOnline).toBe(false)

    bt.online = true
    rerender()
    expect(result.current.wasOnline).toBe(true)

    bt.online = false
    rerender()
    expect(result.current.online).toBe(false)
    expect(result.current.wasOnline).toBe(true)
  })

  it('does not latch on an unknown online state', () => {
    const { result, rerender } = renderHook(() => useConnectivity())
    bt.online = null
    rerender()
    expect(result.current.wasOnline).toBe(false)
  })
})
