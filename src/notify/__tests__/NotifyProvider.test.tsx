import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NotifyProvider } from '../NotifyProvider'
import { useNotify } from '../notifyContext'
import { VoiceNotifier } from '@/voice/VoiceNotifier'
import type { ApiEvent } from '@/api/types'

const bus = vi.hoisted(() => ({ listener: null as ((event: ApiEvent) => void) | null }))
vi.mock('@/api/eventBus', () => ({
  subscribeEvents: (listener: (event: ApiEvent) => void) => {
    bus.listener = listener
    return () => {
      bus.listener = null
    }
  },
}))
afterEach(() => vi.useRealTimers())

const icon = () =>
  screen.getByRole('status').querySelector('svg')?.getAttribute('data-notification-icon')

it('uses voice-specific icons, and preserves warning/success semantics', () => {
  render(
    <NotifyProvider>
      <VoiceNotifier />
    </NotifyProvider>,
  )
  for (const [state, expected] of [
    ['listening', 'microphone'],
    ['thinking', 'thinking'],
    ['playing', 'play'],
    ['done', 'success'],
    ['error', 'warning'],
  ]) {
    act(() => bus.listener?.({ type: 'voice', data: { state } } as ApiEvent))
    expect(icon()).toBe(expected)
  }
})

it('does not leak a contextual icon into the next ordinary or error notification', () => {
  vi.useFakeTimers()
  function Buttons() {
    const notify = useNotify()
    return (
      <>
        <button onClick={() => notify('Playing from favourites', { icon: 'playlist' })}>
          Playlist
        </button>
        <button onClick={() => notify('Nothing playing')}>Info</button>
        <button onClick={() => notify('Skip failed', { variant: 'error' })}>Error</button>
      </>
    )
  }
  render(
    <NotifyProvider>
      <Buttons />
    </NotifyProvider>,
  )
  for (const [label, expected] of [
    ['Playlist', 'playlist'],
    ['Info', 'info'],
    ['Error', 'error'],
  ]) {
    fireEvent.click(screen.getByText(label))
    expect(icon()).toBe(expected)
  }
  act(() => vi.advanceTimersByTime(2600))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('reuses the picker device types and does not retain the previous device icon', () => {
  function Devices() {
    const notify = useNotify()
    return (
      <>
        {['COMPUTER', 'smartphone', 'TABLET', 'SPEAKER'].map((type) => (
          <button
            key={type}
            onClick={() => notify(`Now playing on ${type}`, { icon: 'device', deviceType: type })}
          >
            {type}
          </button>
        ))}
        <button onClick={() => notify('Nothing playing')}>Info</button>
      </>
    )
  }
  render(
    <NotifyProvider>
      <Devices />
    </NotifyProvider>,
  )
  for (const [type, expected] of [
    ['COMPUTER', 'pc'],
    ['smartphone', 'phone'],
    ['TABLET', 'phone'],
    ['SPEAKER', 'generic'],
  ]) {
    fireEvent.click(screen.getByRole('button', { name: type }))
    expect(screen.getByRole('status').querySelector('svg')).toHaveAttribute(
      'data-device-type',
      expected,
    )
  }
  fireEvent.click(screen.getByRole('button', { name: 'Info' }))
  expect(icon()).toBe('info')
})
