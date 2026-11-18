import { describe, expect, it, vi } from 'vitest'
import { createPagedCache, type FetchedPage } from '../pagedCache'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Page = FetchedPage<string, undefined>
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('createPagedCache', () => {
  it('appends pages from next_offset and stops at the last', async () => {
    const fetchPage = vi.fn(async (_k: string, offset: number): Promise<Page> =>
      offset === 0
        ? { items: ['a', 'b'], total: 3, next_offset: 2 }
        : { items: ['c'], total: 3, next_offset: null },
    )
    const cache = createPagedCache({ fetchPage, limit: 2 })
    cache.load('k')
    await flush()
    cache.load('k')
    await flush()
    cache.load('k')
    expect(cache.get('k')).toMatchObject({ items: ['a', 'b', 'c'], loaded: true, nextOffset: null })
    expect(fetchPage.mock.calls.map((c) => c[1])).toEqual([0, 2])
  })

  it('ignores a load while one is in flight, and keeps items through a failed page', async () => {
    const pending = deferred<Page>()
    const fetchPage = vi
      .fn<(k: string, o: number) => Promise<Page>>()
      .mockResolvedValueOnce({ items: ['a'], total: 2, next_offset: 1 })
      .mockReturnValueOnce(pending.promise)
    const cache = createPagedCache({ fetchPage, limit: 1 })
    cache.load('k')
    await flush()
    cache.load('k')
    cache.load('k')
    expect(fetchPage).toHaveBeenCalledTimes(2)
    pending.reject(new Error('boom'))
    await flush()
    expect(cache.get('k')).toMatchObject({ items: ['a'], loading: false, nextOffset: 1 })
    expect(cache.get('k').error).toBeInstanceOf(Error)
  })

  it('drops repeats when deduping', async () => {
    const fetchPage = vi
      .fn<(k: string, o: number) => Promise<Page>>()
      .mockResolvedValueOnce({ items: ['a', 'b'], total: 3, next_offset: 2 })
      .mockResolvedValueOnce({ items: ['b', 'c'], total: 3, next_offset: null })
    const cache = createPagedCache({ fetchPage, limit: 2, dedupeBy: (s) => s })
    cache.load('k')
    await flush()
    cache.load('k')
    await flush()
    expect(cache.get('k').items).toEqual(['a', 'b', 'c'])
  })

  it('keeps an item whose dedupe id is undefined', async () => {
    const fetchPage = vi
      .fn<(k: string, o: number) => Promise<Page>>()
      .mockResolvedValueOnce({ items: ['a', 'x'], total: 4, next_offset: 2 })
      .mockResolvedValueOnce({ items: ['a', 'x'], total: 4, next_offset: null })
    const dedupeBy = (s: string) => (s === 'x' ? undefined : s)
    const cache = createPagedCache({ fetchPage, limit: 2, dedupeBy })
    cache.load('k')
    await flush()
    cache.load('k')
    await flush()
    expect(cache.get('k').items).toEqual(['a', 'x', 'x'])
  })

  it('goes on to the next page when one adds nothing new', async () => {
    const fetchPage = vi
      .fn<(k: string, o: number) => Promise<Page>>()
      .mockResolvedValueOnce({ items: ['a', 'b'], total: 6, next_offset: 2 })
      .mockResolvedValueOnce({ items: ['a', 'b'], total: 6, next_offset: 4 })
      .mockResolvedValueOnce({ items: ['c'], total: 6, next_offset: null })
    const cache = createPagedCache({ fetchPage, limit: 2, dedupeBy: (s) => s })
    cache.load('k')
    await flush()
    cache.load('k')
    await flush()
    await flush()
    expect(cache.get('k')).toMatchObject({ items: ['a', 'b', 'c'], nextOffset: null })
    expect(fetchPage.mock.calls.map((c) => c[1])).toEqual([0, 2, 4])
  })

  it('stops on an empty page whose next_offset does not move on', async () => {
    const fetchPage = vi
      .fn<(k: string, o: number) => Promise<Page>>()
      .mockResolvedValueOnce({ items: ['a'], total: 3, next_offset: 1 })
      .mockResolvedValue({ items: [], total: 3, next_offset: 1 })
    const cache = createPagedCache({ fetchPage, limit: 1 })
    cache.load('k')
    await flush()
    cache.load('k')
    await flush()
    await flush()
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('does not evict an entry with a page in flight', async () => {
    const pending = deferred<Page>()
    const fetchPage = vi.fn(async (key: string, offset: number): Promise<Page> => {
      if (key === 'a' && offset === 1) return pending.promise
      return { items: [`${key}${offset}`], total: 2, next_offset: offset === 0 ? 1 : null }
    })
    const cache = createPagedCache({ fetchPage, limit: 1, maxEntries: 1 })
    cache.load('a')
    await flush()
    cache.load('a')
    cache.load('b')
    await flush()
    pending.resolve({ items: ['a1'], total: 2, next_offset: null })
    await flush()
    expect(cache.get('a').items).toEqual(['a0', 'a1'])
  })

  it('evicts the least recently written unwatched entry past maxEntries', async () => {
    const fetchPage = async (key: string): Promise<Page> => ({
      items: [key],
      total: 1,
      next_offset: null,
    })
    const cache = createPagedCache({ fetchPage, limit: 1, maxEntries: 2 })
    const unwatch = cache.subscribe('a', () => {})
    for (const k of ['a', 'b', 'c']) {
      cache.load(k)
      await flush()
    }
    expect(cache.get('a').loaded).toBe(true)
    expect(cache.get('b').loaded).toBe(false)
    expect(cache.get('c').loaded).toBe(true)
    unwatch()
  })

  it('lets a request from before clear land nowhere', async () => {
    const pending = deferred<Page>()
    const cache = createPagedCache({ fetchPage: () => pending.promise, limit: 1 })
    cache.load('k')
    cache.clear()
    pending.resolve({ items: ['stale'], total: 1, next_offset: null })
    await flush()
    expect(cache.get('k').loaded).toBe(false)
  })
})
