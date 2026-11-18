import { useCallback, useEffect, useSyncExternalStore } from 'react'

export interface FetchedPage<T, M> {
  items: readonly T[]
  total: number
  next_offset: number | null
  /** what the page says about the list as a whole, e.g. the playlist itself */
  meta?: M
}

export interface PagedList<T, M = undefined> {
  items: readonly T[]
  total: number
  /** null once the last page is in, or before the first one */
  nextOffset: number | null
  meta: M | null
  /** the first page has landed */
  loaded: boolean
  loading: boolean
  /** the last request's failure, cleared by the next one */
  error: unknown
}

export interface PagedCacheOptions<T, M> {
  fetchPage: (key: string, offset: number, limit: number) => Promise<FetchedPage<T, M>>
  limit: number
  /** drops an item already in the list, which an edit between pages can repeat; undefined keeps it */
  dedupeBy?: (item: T) => string | undefined
  /** least recently read entries beyond this are dropped */
  maxEntries?: number
}

export interface PagedCache<T, M> {
  get: (key: string) => PagedList<T, M>
  subscribe: (key: string, listener: () => void) => () => void
  /** the first page, or the next one; a no-op while one is in flight or once all are in */
  load: (key: string) => void
  clear: () => void
}

/**
 * Paged lists kept for the session, by key. Requests finish into the cache even after their page
 * unmounts, so coming back finds them.
 */
export function createPagedCache<T, M = undefined>({
  fetchPage,
  limit,
  dedupeBy,
  maxEntries = Infinity,
}: PagedCacheOptions<T, M>): PagedCache<T, M> {
  const empty: PagedList<T, M> = {
    items: [],
    total: 0,
    nextOffset: null,
    meta: null,
    loaded: false,
    loading: false,
    error: null,
  }
  const entries = new Map<string, PagedList<T, M>>()
  const listeners = new Map<string, Set<() => void>>()
  // bumped by clear, so a request from before it lands nowhere
  let generation = 0

  const set = (key: string, next: PagedList<T, M>) => {
    entries.delete(key)
    entries.set(key, next)
    for (const k of entries.keys()) {
      if (entries.size <= maxEntries) break
      // an in-flight entry stays, or its page would land as if it were the first
      if (k !== key && !listeners.get(k)?.size && !entries.get(k)?.loading) entries.delete(k)
    }
    listeners.get(key)?.forEach((fn) => fn())
  }

  const get = (key: string) => entries.get(key) ?? empty

  const load = (key: string) => {
    const at = get(key)
    if (at.loading || (at.loaded && at.nextOffset === null)) return
    const offset = at.loaded ? (at.nextOffset ?? 0) : 0
    const gen = generation
    set(key, { ...at, loading: true, error: null })
    fetchPage(key, offset, limit).then(
      (page) => {
        if (gen !== generation) return
        const prev = get(key)
        let items = page.items
        if (dedupeBy) {
          const seen = new Set(prev.items.map(dedupeBy))
          items = items.filter((item) => {
            const id = dedupeBy(item)
            return id === undefined || !seen.has(id)
          })
        }
        set(key, {
          items: prev.loaded ? [...prev.items, ...items] : items,
          total: page.total,
          nextOffset: page.next_offset,
          meta: page.meta ?? prev.meta,
          loaded: true,
          loading: false,
          error: null,
        })
        // a page that added nothing would leave the list's end where it was, so nothing asks again
        if (prev.loaded && items.length === 0 && (page.next_offset ?? 0) > offset) load(key)
      },
      (error: unknown) => {
        if (gen !== generation) return
        set(key, { ...get(key), loading: false, error })
      },
    )
  }

  return {
    get,
    subscribe(key, listener) {
      let fns = listeners.get(key)
      if (!fns) listeners.set(key, (fns = new Set()))
      fns.add(listener)
      return () => {
        fns.delete(listener)
      }
    },
    load,
    clear() {
      generation++
      entries.clear()
    },
  }
}

export interface UsePagedList<T, M> extends PagedList<T, M> {
  /** the first page failed, so there is nothing to show but a retry */
  failedFirst: boolean
  /** a row belongs after the last item: the next page loading, or a retry for it */
  hasTail: boolean
  /** the next page, for `KnobList`'s `onEndReached` */
  loadMore: () => void
  /** repeats whichever request failed */
  retry: () => void
}

/** One list from `cache`, starting its first page on mount unless the cache already has it. */
export function usePagedList<T, M>(cache: PagedCache<T, M>, key: string): UsePagedList<T, M> {
  const subscribe = useCallback((fn: () => void) => cache.subscribe(key, fn), [cache, key])
  const getSnapshot = useCallback(() => cache.get(key), [cache, key])
  const list = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (!cache.get(key).loaded) cache.load(key)
  }, [cache, key])

  const loadMore = useCallback(() => {
    // a failed page waits for an explicit retry
    if (!cache.get(key).error) cache.load(key)
  }, [cache, key])
  const retry = useCallback(() => cache.load(key), [cache, key])

  return {
    ...list,
    failedFirst: !list.loaded && !!list.error,
    hasTail: list.loaded && (list.nextOffset !== null || !!list.error),
    loadMore,
    retry,
  }
}
