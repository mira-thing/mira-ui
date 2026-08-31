import { describe, expect, it } from 'vitest'
import { resolveRoute, type RouteInput } from '../routes'
import type { ObserverStatus } from '@/api/types'
import { activeStatus } from '../../__tests__/fixtures/observer'

const idle: ObserverStatus = { active: false, message: 'no session' }

// resolves to the player; each test overrides only what it cares about
function input(over: Partial<RouteInput> = {}): RouteInput {
  return {
    offlineScreen: null,
    auth: { required: false, url: null, loading: false },
    status: activeStatus,
    setupProgress: null,
    loading: false,
    online: true,
    reconnecting: false,
    playerStartingUp: false,
    spotifyStuck: false,
    splashOnlineStuck: false,
    loadStuck: false,
    ...over,
  }
}

describe('resolveRoute', () => {
  it('routes to the player when a device is active', () => {
    expect(resolveRoute(input())).toEqual({ kind: 'player' })
  })

  it('routes to idle when nothing is playing', () => {
    expect(resolveRoute(input({ status: idle }))).toEqual({ kind: 'idle' })
  })

  it('shows the auth screen once a url is available', () => {
    const route = resolveRoute(
      input({ auth: { required: true, url: 'https://x', loading: false } }),
    )
    expect(route).toEqual({ kind: 'auth', url: 'https://x' })
  })

  it('does not show the auth screen while the url is still missing', () => {
    const route = resolveRoute(input({ auth: { required: true, url: null, loading: false } }))
    expect(route.kind).toBe('player')
  })

  it('waits on a bare auth screen while the daemon resolves auth after a pan pairing', () => {
    const route = resolveRoute(
      input({ status: idle, auth: { required: false, url: null, loading: true } }),
    )
    expect(route).toEqual({ kind: 'auth-pending', stuck: false })
  })

  it('marks the pre-auth wait as stuck so the screen can offer a hint', () => {
    const route = resolveRoute(
      input({ status: idle, auth: { required: false, url: null, loading: true }, loadStuck: true }),
    )
    expect(route).toEqual({ kind: 'auth-pending', stuck: true })
  })

  it('boots while the first status is still in flight', () => {
    expect(resolveRoute(input({ status: null, loading: true }))).toEqual({
      kind: 'booting',
      stuck: false,
    })
  })

  it('boots while the dealer reconnects', () => {
    expect(resolveRoute(input({ status: idle, playerStartingUp: true }))).toEqual({
      kind: 'booting',
      stuck: false,
    })
  })

  it('only marks the boot splash stuck once online and past the auth url', () => {
    const stuck = { status: null, loading: true, loadStuck: true }
    expect(resolveRoute(input({ ...stuck, online: true }))).toEqual({
      kind: 'booting',
      stuck: true,
    })
    expect(resolveRoute(input({ ...stuck, online: false }))).toEqual({
      kind: 'booting',
      stuck: false,
    })
    expect(
      resolveRoute(
        input({ ...stuck, auth: { required: false, url: 'https://x', loading: false } }),
      ),
    ).toEqual({ kind: 'booting', stuck: false })
  })

  it('shows first-boot setup with the reported progress', () => {
    const status: ObserverStatus = { active: false, setting_up: true }
    const setupProgress = { stage: 'catalog', done: 47, total: 100, percent: 47 }
    expect(resolveRoute(input({ status, setupProgress }))).toEqual({
      kind: 'setting-up',
      progress: 47,
    })
    expect(resolveRoute(input({ status }))).toEqual({ kind: 'setting-up', progress: null })
  })

  it('reports spotify as unreachable once the splash has waited too long', () => {
    const stuck = { spotifyStuck: true, splashOnlineStuck: true }
    expect(resolveRoute(input({ status: idle, ...stuck }))).toEqual({ kind: 'spotify-unreachable' })
  })

  describe('offline', () => {
    it('outranks every other screen', () => {
      const route = resolveRoute(
        input({
          offlineScreen: 'reconnecting',
          auth: { required: true, url: 'https://x', loading: false },
          spotifyStuck: true,
          splashOnlineStuck: true,
        }),
      )
      expect(route).toEqual({ kind: 'offline', screen: 'reconnecting' })
    })

    it('passes the resolved screen through', () => {
      expect(resolveRoute(input({ offlineScreen: 'pc' }))).toEqual({
        kind: 'offline',
        screen: 'pc',
      })
    })
  })

  describe('reconnecting', () => {
    // the player stays mounted on the held status through a short drop, so
    // nothing below the auth screens may steal the render
    it.each(['booting', 'setting-up', 'idle', 'spotify-unreachable'] as const)(
      'suppresses %s',
      (suppressed) => {
        const over: Record<string, Partial<RouteInput>> = {
          booting: { status: null, loading: true },
          'setting-up': { status: { active: false, setting_up: true } },
          idle: { status: idle },
          'spotify-unreachable': {
            status: idle,
            spotifyStuck: true,
            splashOnlineStuck: true,
          },
        }
        expect(resolveRoute(input({ ...over[suppressed], reconnecting: false })).kind).toBe(
          suppressed,
        )
        expect(resolveRoute(input({ ...over[suppressed], reconnecting: true })).kind).toBe('player')
      },
    )

    it('still yields to the offline and auth screens', () => {
      expect(resolveRoute(input({ reconnecting: true, offlineScreen: 'checking' })).kind).toBe(
        'offline',
      )
      expect(
        resolveRoute(
          input({ reconnecting: true, auth: { required: true, url: 'https://x', loading: false } }),
        ).kind,
      ).toBe('auth')
    })
  })

  it('prefers the pre-auth wait over the boot splash', () => {
    // both match on a loading auth with no active device; order decides
    const route = resolveRoute(
      input({ status: idle, auth: { required: false, url: null, loading: true }, loading: true }),
    )
    expect(route.kind).toBe('auth-pending')
  })
})
