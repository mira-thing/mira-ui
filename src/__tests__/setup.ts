import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw-server'

// node 26 ships an experimental built-in localStorage that stays inert unless the
// process gets --localstorage-file, and it shadows jsdom's, so the global lands as
// undefined and anything touching the settings store dies. a plain synchronous
// key/value store is all these tests need. runs per file, so each gets a clean one
if (typeof globalThis.localStorage === 'undefined') {
  let store = new Map<string, string>()
  const shim: Storage = {
    get length() {
      return store.size
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => store.get(String(k)) ?? null,
    setItem: (k, v) => {
      store.set(String(k), String(v))
    },
    removeItem: (k) => {
      store.delete(String(k))
    },
    clear: () => {
      store = new Map()
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: shim })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: shim })
  }
}

// jsdom has no element.animate()
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = () => ({ cancel() {} }) as unknown as Animation
}

// onUnhandledRequest: 'error' surfaces fetches we forgot to mock
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())
